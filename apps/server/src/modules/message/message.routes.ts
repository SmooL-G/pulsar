import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { LIMITS } from '@pulsar/shared';

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
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        commentsEnabled: m.commentsEnabled,
        commentChatId: m.commentChatId,
        commentCount: m.commentChatId ? (commentMap.get(m.commentChatId) || 0) : undefined,
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
}
