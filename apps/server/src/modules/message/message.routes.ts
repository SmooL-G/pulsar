import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { LIMITS } from '@pulsar/shared';
import { getIO } from '../../socket/index.js';

interface RawReaction { emoji: string; userId: string }

function groupReactions(rows: RawReaction[]) {
  const map = new Map<string, { emoji: string; count: number; userIds: string[] }>();
  for (const r of rows) {
    let entry = map.get(r.emoji);
    if (!entry) { entry = { emoji: r.emoji, count: 0, userIds: [] }; map.set(r.emoji, entry); }
    entry.count++;
    entry.userIds.push(r.userId);
  }
  return Array.from(map.values());
}

interface RawCheck { itemId: string; userId: string }

function groupChecks(rows: RawCheck[]) {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.itemId) || [];
    list.push(r.userId);
    map.set(r.itemId, list);
  }
  return Array.from(map.entries()).map(([itemId, userIds]) => ({ itemId, userIds }));
}

interface RawVote { optionId: string; userId: string }

function groupVotes(rows: RawVote[]) {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.optionId) || [];
    list.push(r.userId);
    map.set(r.optionId, list);
  }
  return Array.from(map.entries()).map(([optionId, userIds]) => ({ optionId, userIds }));
}

export async function messageRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Get messages for a chat (cursor-based pagination)
  app.get<{ Params: { chatId: string } }>('/chat/:chatId', async (request, reply) => {
    const userId = request.user!.userId;
    const { chatId } = request.params;
    const { cursor, limit = LIMITS.MESSAGES_PER_PAGE } = request.query as {
      cursor?: string;
      limit?: number;
    };

    // Verify membership
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });

    if (!member || member.leftAt) {
      return reply.status(403).send({ error: 'NOT_CHAT_MEMBER', message: 'Not a member of this chat' });
    }

    const messages = await prisma.message.findMany({
      where: {
        chatId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit), 100),
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verificationLevel: true,
            profileBadge: true,
            nickColor: true,
            avatarFrame: true,
            bubbleColor: true,
            nftAvatarMint: true,
            role: true,
          },
        },
        attachments: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            s3Key: true,
            thumbnailKey: true,
            width: true,
            height: true,
            duration: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            senderId: true,
            sender: {
              select: { username: true, displayName: true, verificationLevel: true },
            },
          },
        },
        reactions: { select: { emoji: true, userId: true } },
        checklistChecks: { select: { itemId: true, userId: true } },
        pollVotes: { select: { optionId: true, userId: true } },
      },
    });

    const nextCursor =
      messages.length === Number(limit)
        ? messages[messages.length - 1].createdAt.toISOString()
        : null;

    // Get read receipt counts for own messages
    const ownMessageIds = messages.filter((m) => m.senderId === userId).map((m) => m.id);
    const readReceipts = ownMessageIds.length > 0
      ? await prisma.readReceipt.groupBy({
          by: ['messageId'],
          where: { messageId: { in: ownMessageIds } },
          _count: true,
        })
      : [];
    const readMap = new Map(readReceipts.map((r) => [r.messageId, r._count]));

    // Get comment counts for messages that have comment chats
    const commentChatIds = messages
      .filter((m) => m.commentChatId)
      .map((m) => m.commentChatId!);
    const commentCounts = commentChatIds.length > 0
      ? await prisma.message.groupBy({
          by: ['chatId'],
          where: { chatId: { in: commentChatIds } },
          _count: true,
        })
      : [];
    const commentMap = new Map(commentCounts.map((c) => [c.chatId, c._count]));

    return {
      messages: messages.map((m) => ({
        ...m,
        attachments: m.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          fileSize: Number(a.fileSize),
          mimeType: a.mimeType,
          url: a.s3Key,
          thumbnailUrl: a.thumbnailKey || undefined,
          width: a.width,
          height: a.height,
          duration: a.duration,
        })),
        reactions: groupReactions(m.reactions),
        checklistChecks: groupChecks(m.checklistChecks),
        pollVotes: groupVotes(m.pollVotes),
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        commentsEnabled: m.commentsEnabled,
        commentChatId: m.commentChatId,
        commentCount: m.commentChatId ? (commentMap.get(m.commentChatId) || 0) : undefined,
        // BigInt → string for JSON safety
        superchatAmount: (m as any).superchatAmount?.toString() ?? null,
        superchatTier: (m as any).superchatTier ?? null,
        pinnedUntil: (m as any).pinnedUntil?.toISOString() ?? null,
        status: m.senderId === userId
          ? (readMap.get(m.id) ? 'read' : 'delivered')
          : undefined,
      })),
      nextCursor,
    };
  });

  // POST /messages/:messageId/comments — get or create comment chat for a message
  app.post<{ Params: { messageId: string } }>('/:messageId/comments', async (request, reply) => {
    const userId = request.user!.userId;
    const { messageId } = request.params;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: true, sender: { select: { username: true } } },
    });

    if (!message) {
      return reply.status(404).send({ error: 'MESSAGE_NOT_FOUND' });
    }

    // Check user is member of the channel
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: message.chatId, userId } },
    });
    if (!member || member.leftAt) {
      return reply.status(403).send({ error: 'NOT_MEMBER' });
    }

    if (!message.commentsEnabled) {
      return reply.status(400).send({ error: 'COMMENTS_DISABLED' });
    }

    // If comment chat already exists, return it
    if (message.commentChatId) {
      // Auto-join user to comment chat if not already
      const commentMember = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: message.commentChatId, userId } },
      });
      if (!commentMember) {
        await prisma.chatMember.create({
          data: { chatId: message.commentChatId, userId, role: 'MEMBER' },
        });
      } else if (commentMember.leftAt) {
        await prisma.chatMember.update({
          where: { id: commentMember.id },
          data: { leftAt: null },
        });
      }

      const count = await prisma.message.count({ where: { chatId: message.commentChatId } });
      return { commentChatId: message.commentChatId, commentCount: count };
    }

    // Create new comment chat
    const preview = (message.content || '').slice(0, 50);
    const chatName = `💬 ${message.sender.username}: ${preview}${(message.content?.length || 0) > 50 ? '...' : ''}`;

    const commentChat = await prisma.chat.create({
      data: {
        type: 'GROUP',
        name: chatName,
        ownerId: message.senderId,
        isPublic: false,
        members: {
          create: [
            { userId: message.senderId, role: 'OWNER' },
            ...(userId !== message.senderId ? [{ userId, role: 'MEMBER' as const }] : []),
          ],
        },
      },
    });

    // Link comment chat to message
    await prisma.message.update({
      where: { id: messageId },
      data: { commentChatId: commentChat.id },
    });

    return { commentChatId: commentChat.id, commentCount: 0 };
  });

  // GET /messages/:messageId/comment-count
  app.get<{ Params: { messageId: string } }>('/:messageId/comment-count', async (request) => {
    const { messageId } = request.params;
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { commentChatId: true, commentsEnabled: true },
    });

    if (!message?.commentChatId) return { count: 0 };

    const count = await prisma.message.count({ where: { chatId: message.commentChatId } });
    return { count };
  });

  // POST /messages/:messageId/callback — user clicks inline bot button
  app.post<{ Params: { messageId: string }; Body: { callbackData: string } }>(
    '/:messageId/callback',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { messageId } = request.params;
      const { callbackData } = request.body;

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true, chatId: true, senderId: true,
          sender: { select: { id: true, username: true, botProfile: { select: { id: true, webhookUrl: true, webhookSecret: true } } } },
        },
      });

      if (!message) return reply.status(404).send({ error: 'MESSAGE_NOT_FOUND' });

      const botProfile = (message.sender as any)?.botProfile;
      if (!botProfile) return reply.status(400).send({ error: 'NOT_A_BOT_MESSAGE' });

      // For PulsarBot (system bot) — treat callbackData as a command message
      const senderUsername = (message.sender as any)?.username;
      if (senderUsername === 'pulsarbot') {
        const { handlePulsarBotMessage } = await import('../bot/pulsarBot.handler.js');
        await handlePulsarBotMessage(userId, message.chatId, callbackData);
        return { ok: true };
      }
      // (Pulsar GPT bot moved out-of-process; callback dispatch goes
      //  via the standard bot SDK long-poll path below.)

      // For user bots — dispatch to webhook
      const { dispatchBotCallback } = await import('../bot/webhook.service.js');
      await dispatchBotCallback(
        { id: botProfile.id, webhookUrl: botProfile.webhookUrl, webhookSecret: botProfile.webhookSecret },
        {
          update_id: Date.now(),
          callback_query: {
            id: `${messageId}-${Date.now()}`,
            from: { id: userId },
            message: { id: messageId, chat: { id: message.chatId } },
            data: callbackData,
          },
        }
      );

      return { ok: true };
    }
  );

  // GET /messages/shared/:chatId — get shared media & documents for a chat
  app.get<{ Params: { chatId: string } }>('/shared/:chatId', async (request, reply) => {
    const userId = request.user!.userId;
    const { chatId } = request.params;
    const { type = 'all' } = request.query as { type?: 'all' | 'media' | 'documents' };

    // Check membership
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!member || member.leftAt) {
      return reply.status(403).send({ error: 'NOT_MEMBER' });
    }

    // Build mimeType filter
    const mimeFilter = type === 'media'
      ? { OR: [{ mimeType: { startsWith: 'image/' } }, { mimeType: { startsWith: 'video/' } }] }
      : type === 'documents'
        ? { NOT: [{ mimeType: { startsWith: 'image/' } }, { mimeType: { startsWith: 'video/' } }] }
        : {};

    const attachments = await prisma.fileAttachment.findMany({
      where: {
        message: { chatId, isDeleted: false },
        ...mimeFilter,
      },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        s3Key: true,
        thumbnailKey: true,
        width: true,
        height: true,
        createdAt: true,
        message: {
          select: {
            senderId: true,
            sender: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      items: attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: Number(a.fileSize),
        mimeType: a.mimeType,
        url: a.s3Key,
        thumbnailUrl: a.thumbnailKey || undefined,
        width: a.width,
        height: a.height,
        createdAt: a.createdAt.toISOString(),
        sender: a.message.sender.username,
      })),
    };
  });

  // Toggle a reaction on a message. If the user already reacted with the same
  // emoji, that reaction is removed; otherwise it's added.
  app.post<{ Params: { messageId: string }; Body: { emoji: string } }>(
    '/:messageId/react',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { messageId } = request.params;
      const { emoji } = request.body;

      if (!emoji || typeof emoji !== 'string' || emoji.length > 8) {
        return reply.status(400).send({ error: 'INVALID_EMOJI' });
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, chatId: true, isDeleted: true, senderId: true },
      });
      if (!message || message.isDeleted) {
        return reply.status(404).send({ error: 'MESSAGE_NOT_FOUND' });
      }

      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: message.chatId, userId } },
      });
      if (!member || member.leftAt) {
        return reply.status(403).send({ error: 'NOT_CHAT_MEMBER' });
      }

      const existing = await prisma.reaction.findUnique({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      });
      const isAdding = !existing;
      if (existing) {
        await prisma.reaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.reaction.create({ data: { messageId, userId, emoji } });
      }

      // Activity reward to the message author when a NEW reaction is added.
      if (isAdding) {
        (async () => {
          try {
            const { tryRewardForReaction } = await import('../activity/activity.service.js');
            await tryRewardForReaction({
              authorId: message.senderId,
              reactorId: userId,
              chatId: message.chatId,
              isDeleted: message.isDeleted,
            });
          } catch (err) {
            console.error('[activity] reaction reward error:', err);
          }
        })();
      }

      const all = await prisma.reaction.findMany({
        where: { messageId },
        select: { emoji: true, userId: true },
      });
      const reactions = groupReactions(all);

      const io = getIO();
      if (io) {
        io.to(`chat:${message.chatId}`).emit('message:reaction', {
          messageId,
          chatId: message.chatId,
          reactions,
        });
      }

      return { reactions };
    },
  );

  // Toggle a checkbox on a CHECKLIST message. Same semantics as reactions:
  // second call from the same user on the same item removes the check.
  app.post<{ Params: { messageId: string }; Body: { itemId: string } }>(
    '/:messageId/checklist-toggle',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { messageId } = request.params;
      const { itemId } = request.body;

      if (!itemId || typeof itemId !== 'string' || itemId.length > 64) {
        return reply.status(400).send({ error: 'INVALID_ITEM_ID' });
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, chatId: true, type: true, isDeleted: true, metadata: true },
      });
      if (!message || message.isDeleted) {
        return reply.status(404).send({ error: 'MESSAGE_NOT_FOUND' });
      }
      if (message.type !== 'CHECKLIST') {
        return reply.status(400).send({ error: 'NOT_A_CHECKLIST' });
      }

      // Guard: itemId must belong to this checklist (prevents arbitrary keys).
      const checklist = (message.metadata as any)?.checklist;
      const items: { id: string }[] = Array.isArray(checklist?.items) ? checklist.items : [];
      if (!items.some((it) => it.id === itemId)) {
        return reply.status(400).send({ error: 'UNKNOWN_ITEM' });
      }

      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: message.chatId, userId } },
      });
      if (!member || member.leftAt) {
        return reply.status(403).send({ error: 'NOT_CHAT_MEMBER' });
      }

      const existing = await prisma.checklistCheck.findUnique({
        where: { messageId_itemId_userId: { messageId, itemId, userId } },
      });
      if (existing) {
        await prisma.checklistCheck.delete({ where: { id: existing.id } });
      } else {
        await prisma.checklistCheck.create({ data: { messageId, itemId, userId } });
      }

      const all = await prisma.checklistCheck.findMany({
        where: { messageId },
        select: { itemId: true, userId: true },
      });
      const checks = groupChecks(all);

      const io = getIO();
      if (io) {
        io.to(`chat:${message.chatId}`).emit('checklist:update', {
          messageId,
          chatId: message.chatId,
          checks,
        });
      }

      return { checks };
    },
  );

  // Cast (or switch / toggle) a vote on a POLL message. Single-choice polls
  // replace any previous vote by the user; multi-choice polls toggle the
  // selected option independently.
  app.post<{ Params: { messageId: string }; Body: { optionId: string } }>(
    '/:messageId/poll-vote',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { messageId } = request.params;
      const { optionId } = request.body;

      if (!optionId || typeof optionId !== 'string' || optionId.length > 64) {
        return reply.status(400).send({ error: 'INVALID_OPTION_ID' });
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, chatId: true, type: true, isDeleted: true, metadata: true },
      });
      if (!message || message.isDeleted) {
        return reply.status(404).send({ error: 'MESSAGE_NOT_FOUND' });
      }
      if (message.type !== 'POLL') {
        return reply.status(400).send({ error: 'NOT_A_POLL' });
      }

      const poll = (message.metadata as any)?.poll;
      const options: { id: string }[] = Array.isArray(poll?.options) ? poll.options : [];
      if (!options.some((op) => op.id === optionId)) {
        return reply.status(400).send({ error: 'UNKNOWN_OPTION' });
      }
      const allowMultiple = !!poll.allowMultiple;

      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: message.chatId, userId } },
      });
      if (!member || member.leftAt) {
        return reply.status(403).send({ error: 'NOT_CHAT_MEMBER' });
      }

      if (allowMultiple) {
        // Toggle just this option.
        const existing = await prisma.pollVote.findUnique({
          where: { messageId_optionId_userId: { messageId, optionId, userId } },
        });
        if (existing) {
          await prisma.pollVote.delete({ where: { id: existing.id } });
        } else {
          await prisma.pollVote.create({ data: { messageId, optionId, userId } });
        }
      } else {
        // Single-choice: clear any prior vote, then add new one — unless the
        // user tapped the option they already had picked, in which case we
        // treat it as a retraction.
        const prior = await prisma.pollVote.findFirst({
          where: { messageId, userId },
        });
        if (prior?.optionId === optionId) {
          await prisma.pollVote.delete({ where: { id: prior.id } });
        } else {
          if (prior) await prisma.pollVote.delete({ where: { id: prior.id } });
          await prisma.pollVote.create({ data: { messageId, optionId, userId } });
        }
      }

      const all = await prisma.pollVote.findMany({
        where: { messageId },
        select: { optionId: true, userId: true },
      });
      const votes = groupVotes(all);

      const io = getIO();
      if (io) {
        io.to(`chat:${message.chatId}`).emit('poll:update', {
          messageId,
          chatId: message.chatId,
          votes,
        });
      }

      return { votes };
    },
  );

  // ─── SCHEDULED MESSAGES ───────────────────────────────────────
  // Stash a message draft for the worker to materialize at sendAt.
  app.post<{
    Body: {
      chatId: string;
      content?: string;
      type?: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'CHECKLIST' | 'POLL';
      metadata?: Record<string, unknown>;
      attachments?: { fileName: string; fileSize: number; mimeType: string; url: string }[];
      sendAt: string;
    };
  }>('/scheduled', async (request, reply) => {
    const userId = request.user!.userId;
    const { chatId, content, type, metadata, attachments, sendAt } = request.body;

    if (!chatId || !sendAt) {
      return reply.status(400).send({ error: 'INVALID_REQUEST' });
    }
    const sendAtDate = new Date(sendAt);
    if (Number.isNaN(sendAtDate.getTime())) {
      return reply.status(400).send({ error: 'INVALID_DATE' });
    }
    if (sendAtDate.getTime() < Date.now() + 30_000) {
      return reply.status(400).send({ error: 'TOO_SOON', message: 'sendAt must be at least 30s in the future' });
    }
    // 30-day cap so the table doesn't accumulate forgotten drafts forever.
    if (sendAtDate.getTime() > Date.now() + 30 * 24 * 3600 * 1000) {
      return reply.status(400).send({ error: 'TOO_FAR', message: 'sendAt must be within 30 days' });
    }

    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!member || member.leftAt) {
      return reply.status(403).send({ error: 'NOT_CHAT_MEMBER' });
    }

    if (!content && (!attachments || attachments.length === 0) && !metadata) {
      return reply.status(400).send({ error: 'EMPTY_MESSAGE' });
    }

    const scheduled = await prisma.scheduledMessage.create({
      data: {
        chatId,
        senderId: userId,
        content: content || null,
        type: (type as any) || 'TEXT',
        metadata: metadata ? (metadata as any) : undefined,
        attachments: attachments ? (attachments as any) : undefined,
        sendAt: sendAtDate,
      },
    });
    return { scheduled };
  });

  // List my scheduled messages, optionally filtered by chat.
  app.get<{ Querystring: { chatId?: string } }>('/scheduled', async (request) => {
    const userId = request.user!.userId;
    const { chatId } = request.query;
    const rows = await prisma.scheduledMessage.findMany({
      where: { senderId: userId, ...(chatId ? { chatId } : {}) },
      orderBy: { sendAt: 'asc' },
    });
    return { scheduled: rows };
  });

  app.delete<{ Params: { id: string } }>('/scheduled/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;
    const row = await prisma.scheduledMessage.findUnique({ where: { id } });
    if (!row || row.senderId !== userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }
    await prisma.scheduledMessage.delete({ where: { id } });
    return { ok: true };
  });

  // Transcribe a VOICE message via Whisper. Premium-only. Result is cached
  // in message.metadata.transcription so repeat calls are free.
  app.post<{ Params: { messageId: string } }>(
    '/:messageId/transcribe',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { messageId } = request.params;
      const { isPremium } = await import('../subscription/premium.service.js');
      const { transcribeAudio } = await import('./transcribe.service.js');

      if (!(await isPremium(userId))) {
        return reply.status(402).send({ error: 'PREMIUM_REQUIRED' });
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true, type: true, chatId: true, isDeleted: true, metadata: true,
          attachments: { select: { s3Key: true, fileName: true } },
        },
      });
      if (!message || message.isDeleted) {
        return reply.status(404).send({ error: 'MESSAGE_NOT_FOUND' });
      }
      if (message.type !== 'VOICE') {
        return reply.status(400).send({ error: 'NOT_A_VOICE_MESSAGE' });
      }

      // Verify the requester is in the chat (so non-members can't snoop voice).
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: message.chatId, userId } },
      });
      if (!member || member.leftAt) {
        return reply.status(403).send({ error: 'NOT_CHAT_MEMBER' });
      }

      // Cached?
      const cached = (message.metadata as any)?.transcription;
      if (typeof cached === 'string' && cached.length > 0) {
        return { transcription: cached, cached: true };
      }

      const att = message.attachments[0];
      if (!att?.s3Key) {
        return reply.status(400).send({ error: 'NO_AUDIO' });
      }

      try {
        const text = await transcribeAudio(att.s3Key, att.fileName);
        const trimmed = text.trim().slice(0, 4000);

        const newMeta = { ...(message.metadata as any || {}), transcription: trimmed };
        await prisma.message.update({
          where: { id: messageId },
          data: { metadata: newMeta },
        });

        const io = getIO();
        if (io) {
          io.to(`chat:${message.chatId}`).emit('message:transcribed', {
            chatId: message.chatId,
            messageId,
            transcription: trimmed,
          });
        }
        return { transcription: trimmed, cached: false };
      } catch (err: any) {
        request.log.error({ err }, 'transcribe failed');
        return reply.status(500).send({ error: 'TRANSCRIBE_FAILED', message: err.message });
      }
    },
  );

  // ─── PIN / UNPIN MESSAGES ────────────────────────────────
  //
  // Auth: any member in DMs; in groups/channels only OWNER/ADMIN/MODERATOR
  // role on ChatMember. Max 3 pinned per chat (older ones get unpinned
  // automatically on a new pin — chronological FIFO).
  //
  // Returns the same PinnedMessage shape the frontend banner consumes:
  // { id, chatId, message: { id, content, type, senderId, sender:{...} } }

  const PIN_LIMIT = 3;
  const PIN_ROLES = new Set(['OWNER', 'ADMIN', 'MODERATOR']);

  async function loadPinnedRows(chatId: string) {
    const rows = await prisma.pinnedMessage.findMany({
      where: { chatId },
      orderBy: { pinnedAt: 'desc' },
      take: PIN_LIMIT,
      include: {
        message: {
          include: {
            sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });
    // Filter out pins whose underlying message was soft-deleted.
    return rows.filter((r) => !r.message?.isDeleted);
  }

  app.get<{ Params: { chatId: string } }>('/chat/:chatId/pinned', async (request, reply) => {
    const userId = request.user!.userId;
    const { chatId } = request.params;
    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { id: true, leftAt: true },
    });
    if (!membership || membership.leftAt) return reply.status(403).send({ error: 'FORBIDDEN' });
    const pinned = await loadPinnedRows(chatId);
    return { pinned };
  });

  app.post<{ Params: { messageId: string } }>('/:messageId/pin', async (request, reply) => {
    const userId = request.user!.userId;
    const { messageId } = request.params;
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true, isDeleted: true, chat: { select: { type: true } } },
    });
    if (!message || message.isDeleted) return reply.status(404).send({ error: 'NOT_FOUND' });

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: message.chatId, userId } },
      select: { role: true, leftAt: true },
    });
    if (!membership || membership.leftAt) return reply.status(403).send({ error: 'NOT_A_MEMBER' });

    // DMs: any party can pin. Groups/channels: privileged roles only.
    const isDM = message.chat.type === 'DIRECT';
    if (!isDM && !PIN_ROLES.has(membership.role)) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only admins/moderators can pin' });
    }

    // FIFO eviction at PIN_LIMIT — delete oldest first to make room.
    const existing = await prisma.pinnedMessage.count({ where: { chatId: message.chatId } });
    if (existing >= PIN_LIMIT) {
      const oldest = await prisma.pinnedMessage.findMany({
        where: { chatId: message.chatId },
        orderBy: { pinnedAt: 'asc' },
        take: existing - PIN_LIMIT + 1,
        select: { id: true },
      });
      await prisma.pinnedMessage.deleteMany({ where: { id: { in: oldest.map((o) => o.id) } } });
    }

    try {
      await prisma.pinnedMessage.create({
        data: { chatId: message.chatId, messageId, pinnedBy: userId },
      });
    } catch (e: any) {
      // P2002 unique violation = already pinned. Idempotent: no-op.
      if (e?.code !== 'P2002') throw e;
    }

    const pinned = await loadPinnedRows(message.chatId);
    const io = getIO();
    io?.to(`chat:${message.chatId}`).emit('chat:pinned-updated', { chatId: message.chatId, pinned } as any);

    return { ok: true, pinned };
  });

  app.delete<{ Params: { messageId: string } }>('/:messageId/pin', async (request, reply) => {
    const userId = request.user!.userId;
    const { messageId } = request.params;
    const pin = await prisma.pinnedMessage.findUnique({
      where: { messageId },
      select: {
        id: true, chatId: true,
        chat: { select: { type: true } },
      },
    });
    if (!pin) return reply.status(404).send({ error: 'NOT_FOUND' });

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: pin.chatId, userId } },
      select: { role: true, leftAt: true },
    });
    if (!membership || membership.leftAt) return reply.status(403).send({ error: 'NOT_A_MEMBER' });

    const isDM = pin.chat.type === 'DIRECT';
    if (!isDM && !PIN_ROLES.has(membership.role)) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    await prisma.pinnedMessage.delete({ where: { id: pin.id } });

    const pinned = await loadPinnedRows(pin.chatId);
    const io = getIO();
    io?.to(`chat:${pin.chatId}`).emit('chat:pinned-updated', { chatId: pin.chatId, pinned } as any);

    return { ok: true, pinned };
  });
}
