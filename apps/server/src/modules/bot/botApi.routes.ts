import type { FastifyInstance } from 'fastify';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import { prisma } from '../../config/database.js';
import { botAuthMiddleware } from '../../middleware/botAuth.js';
import { redis } from '../../config/redis.js';
import { getIO } from '../../socket/index.js';
import { env } from '../../config/env.js';
import { s3Client } from '../../config/s3.js';

export async function botApiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', botAuthMiddleware);

  // GET /me
  app.get('/me', async (request) => {
    const { userId, botId } = request.user as any;
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
    });
    return {
      id: bot?.id,
      username: bot?.user.username,
      displayName: bot?.user.displayName,
      avatarUrl: bot?.user.avatarUrl,
      webhookUrl: bot?.webhookUrl,
      commands: bot?.commands || [],
      isActive: bot?.isActive,
      lastSeenAt: bot?.lastSeenAt?.toISOString() || null,
    };
  });

  // POST /sendMessage — with optional inline buttons + persistent reply keyboard
  app.post<{ Body: {
    chatId: string;
    text: string;
    replyToId?: string;
    buttons?: { text: string; callbackData: string }[][];
    replyKeyboard?: string[][] | null;
  } }>(
    '/sendMessage',
    async (request, reply) => {
      const { userId } = request.user as any;
      const { chatId, text, replyToId, buttons, replyKeyboard } = request.body;

      if (!chatId || !text?.trim()) {
        return reply.status(400).send({ error: 'INVALID_INPUT' });
      }

      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
        select: { leftAt: true },
      });
      if (!membership || membership.leftAt) {
        return reply.status(403).send({ error: 'BOT_NOT_IN_CHAT' });
      }

      // metadata can hold inline buttons AND/OR replyKeyboard (latter is persistent UI)
      const metadata: Record<string, unknown> = {};
      if (buttons?.length) metadata.buttons = buttons;
      if (replyKeyboard !== undefined) metadata.replyKeyboard = replyKeyboard;
      const metaToStore = Object.keys(metadata).length ? metadata : null;

      const message = await prisma.message.create({
        data: {
          chatId,
          senderId: userId,
          content: text.trim(),
          type: 'TEXT',
          replyToId: replyToId || null,
          metadata: metaToStore as any,
        },
        include: {
          sender: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, isBot: true },
          },
        },
      });

      const payload = {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        replyToId: message.replyToId,
        isEdited: false,
        isDeleted: false,
        metadata: message.metadata as any,
        signature: null,
        signerWallet: null,
        encryptedContent: null,
        encryptionType: null,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        sender: message.sender,
        status: 'sent',
        attachments: [],
      };

      const io = getIO();
      if (io) {
        io.to(`chat:${chatId}`).emit('message:new', payload as any);
      }

      return { ok: true, message: payload };
    }
  );

  // POST /sendAudio — send an audio file (downloaded from URL or base64)
  // Body: { chatId, audioUrl, fileName?, caption? }
  app.post<{
    Body: { chatId: string; audioUrl: string; fileName?: string; caption?: string };
  }>('/sendAudio', async (request, reply) => {
    const { userId } = request.user as any;
    const { chatId, audioUrl, fileName, caption } = request.body;

    if (!chatId || !audioUrl) {
      return reply.status(400).send({ error: 'INVALID_INPUT', message: 'chatId and audioUrl required' });
    }

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { leftAt: true },
    });
    if (!membership || membership.leftAt) {
      return reply.status(403).send({ error: 'BOT_NOT_IN_CHAT' });
    }

    // Download audio from given URL
    let buffer: Buffer;
    let mimeType = 'audio/mpeg';
    try {
      const r = await fetch(audioUrl, { redirect: 'follow' });
      if (!r.ok) {
        return reply.status(400).send({ error: 'DOWNLOAD_FAILED', message: `HTTP ${r.status} fetching audio` });
      }
      const ab = await r.arrayBuffer();
      buffer = Buffer.from(ab);
      const ct = r.headers.get('content-type');
      if (ct && ct.startsWith('audio/')) mimeType = ct;
    } catch (err: any) {
      return reply.status(500).send({ error: 'DOWNLOAD_FAILED', message: err.message });
    }

    // Limit: 50MB for bots
    if (buffer.length > 50 * 1024 * 1024) {
      return reply.status(413).send({ error: 'FILE_TOO_LARGE', message: 'Audio exceeds 50MB' });
    }

    const ext = (fileName?.split('.').pop()?.toLowerCase()) || 'mp3';
    const finalName = fileName || `audio-${Date.now()}.${ext}`;
    const key = `files/bot-${userId}/${nanoid()}.${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    const url = env.S3_PUBLIC_URL ? `${env.S3_PUBLIC_URL}/${key}` : `/s3/${env.S3_BUCKET}/${key}`;

    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: caption?.trim() || null,
        type: 'FILE',
        attachments: {
          create: [{
            uploaderId: userId,
            fileName: finalName,
            fileSize: BigInt(buffer.length),
            mimeType,
            s3Key: url,
            s3Bucket: env.S3_BUCKET,
          }],
        },
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isBot: true },
        },
        attachments: {
          select: { id: true, fileName: true, fileSize: true, mimeType: true, s3Key: true },
        },
      },
    });

    const payload = {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      content: message.content,
      type: message.type,
      replyToId: null,
      isEdited: false,
      isDeleted: false,
      metadata: null,
      signature: null,
      signerWallet: null,
      encryptedContent: null,
      encryptionType: null,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      sender: message.sender,
      status: 'sent',
      attachments: message.attachments.map((a: any) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: Number(a.fileSize),
        mimeType: a.mimeType,
        url: a.s3Key,
      })),
    };

    const io = getIO();
    if (io) io.to(`chat:${chatId}`).emit('message:new', payload as any);

    return { ok: true, message: payload };
  });

  // POST /editMessage — bot edits its own message (replace text + buttons + reply keyboard)
  app.post<{
    Body: {
      chatId: string;
      messageId: string;
      text?: string;
      buttons?: { text: string; callbackData: string }[][];
      replyKeyboard?: string[][] | null;
    };
  }>('/editMessage', async (request, reply) => {
    const { userId } = request.user as any;
    const { chatId, messageId, text, buttons, replyKeyboard } = request.body;

    if (!chatId || !messageId) {
      return reply.status(400).send({ error: 'INVALID_INPUT' });
    }

    // Make sure the message belongs to this bot
    const existing = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, chatId: true },
    });
    if (!existing || existing.chatId !== chatId) {
      return reply.status(404).send({ error: 'MESSAGE_NOT_FOUND' });
    }
    if (existing.senderId !== userId) {
      return reply.status(403).send({ error: 'NOT_OWN_MESSAGE' });
    }

    const meta: Record<string, unknown> = {};
    if (buttons?.length) meta.buttons = buttons;
    if (replyKeyboard !== undefined) meta.replyKeyboard = replyKeyboard;
    const metadata = Object.keys(meta).length ? meta : null;

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        ...(text !== undefined ? { content: text.trim() || null } : {}),
        metadata: metadata as any,
        isEdited: true,
      },
      include: {
        sender: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isBot: true },
        },
        attachments: {
          select: { id: true, fileName: true, fileSize: true, mimeType: true, s3Key: true },
        },
      },
    });

    const payload = {
      id: updated.id,
      chatId: updated.chatId,
      senderId: updated.senderId,
      content: updated.content,
      type: updated.type,
      replyToId: updated.replyToId,
      isEdited: true,
      isDeleted: false,
      metadata: updated.metadata as any,
      signature: null,
      signerWallet: null,
      encryptedContent: null,
      encryptionType: null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      sender: updated.sender,
      attachments: updated.attachments.map((a: any) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: Number(a.fileSize),
        mimeType: a.mimeType,
        url: a.s3Key,
      })),
    };

    const io = getIO();
    if (io) io.to(`chat:${chatId}`).emit('message:updated', payload as any);

    return { ok: true, message: payload };
  });

  // POST /deleteMessage — moderate: delete a message
  app.post<{ Body: { chatId: string; messageId: string } }>('/deleteMessage', async (request, reply) => {
    const { userId } = request.user as any;
    const { chatId, messageId } = request.body;

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { role: true, leftAt: true },
    });
    if (!membership || membership.leftAt) return reply.status(403).send({ error: 'BOT_NOT_IN_CHAT' });

    const roleLevel: Record<string, number> = { MEMBER: 0, AUTHOR: 1, MODERATOR: 2, ADMIN: 3, OWNER: 4 };
    if ((roleLevel[membership.role] ?? 0) < 2) return reply.status(403).send({ error: 'INSUFFICIENT_ROLE' });

    await prisma.message.update({ where: { id: messageId }, data: { isDeleted: true, content: null } });
    const io = getIO();
    if (io) io.to(`chat:${chatId}`).emit('message:deleted', { messageId, chatId });

    return { ok: true };
  });

  // POST /kickMember — moderate: kick a user from chat
  app.post<{ Body: { chatId: string; userId: string } }>('/kickMember', async (request, reply) => {
    const botUserId = (request.user as any).userId;
    const { chatId, userId: targetId } = request.body;

    const botMembership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: botUserId } },
      select: { role: true, leftAt: true },
    });
    if (!botMembership || botMembership.leftAt) return reply.status(403).send({ error: 'BOT_NOT_IN_CHAT' });

    const roleLevel: Record<string, number> = { MEMBER: 0, AUTHOR: 1, MODERATOR: 2, ADMIN: 3, OWNER: 4 };
    if ((roleLevel[botMembership.role] ?? 0) < 2) return reply.status(403).send({ error: 'INSUFFICIENT_ROLE' });

    const targetMembership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: targetId } },
      select: { role: true },
    });
    if (!targetMembership) return reply.status(404).send({ error: 'USER_NOT_IN_CHAT' });

    if ((roleLevel[targetMembership.role] ?? 0) >= (roleLevel[botMembership.role] ?? 0)) {
      return reply.status(403).send({ error: 'CANNOT_KICK_HIGHER_ROLE' });
    }

    await prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId: targetId } },
      data: { leftAt: new Date() },
    });

    return { ok: true };
  });

  // POST /answerCallback — acknowledge an inline button press (optionally show toast to user)
  app.post<{ Body: { callbackQueryId?: string; text?: string } }>(
    '/answerCallback',
    async (_request) => {
      // No-op ack. Toast delivery via notifications is future work.
      return { ok: true };
    }
  );

  // GET /updates — long polling (offset = ISO createdAt cursor or '0')
  app.get<{ Querystring: { offset?: string; timeout?: string; limit?: string } }>(
    '/updates',
    async (request, reply) => {
      const { botId } = request.user as any;
      const rawOffset = request.query.offset || '';
      const cursorDate = rawOffset && rawOffset !== '0' ? new Date(rawOffset) : null;
      const timeout = Math.min(Number(request.query.timeout || 30), 60);
      const limit = Math.min(Number(request.query.limit || 100), 100);

      const whereClause = {
        botId,
        ...(cursorDate && !isNaN(cursorDate.getTime()) ? { createdAt: { gt: cursorDate } } : {}),
      };

      // Immediate fetch
      let updates = await prisma.botUpdate.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      if (updates.length > 0) {
        return {
          ok: true,
          result: updates.map((u) => ({
            id: u.id,
            type: u.type,
            payload: u.payload,
            createdAt: u.createdAt.toISOString(),
          })),
        };
      }

      // Long-poll via Redis pub/sub
      const waitMs = timeout * 1000;
      await new Promise<void>((resolve) => {
        const subscriber = redis.duplicate();
        let resolved = false;
        const done = () => {
          if (resolved) return;
          resolved = true;
          subscriber.unsubscribe().catch(() => {});
          subscriber.quit().catch(() => {});
          resolve();
        };

        const timer = setTimeout(done, waitMs);

        subscriber.subscribe(`bot:updates:${botId}`, (err) => {
          if (err) { clearTimeout(timer); done(); }
        });

        subscriber.on('message', () => {
          clearTimeout(timer);
          done();
        });
      });

      updates = await prisma.botUpdate.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      return {
        ok: true,
        result: updates.map((u) => ({
          id: u.id,
          type: u.type,
          payload: u.payload,
          createdAt: u.createdAt.toISOString(),
        })),
      };
    }
  );

  // POST /setWebhook
  app.post<{ Body: { url?: string; secret?: string } }>('/setWebhook', async (request) => {
    const { botId } = request.user as any;
    const { url, secret } = request.body;

    await prisma.bot.update({
      where: { id: botId },
      data: {
        webhookUrl: url || null,
        webhookSecret: secret || null,
      },
    });
    await redis.del(`bot:auth:${botId}`);

    return { ok: true };
  });

  // GET /getChats
  app.get('/getChats', async (request) => {
    const { userId } = request.user as any;
    const memberships = await prisma.chatMember.findMany({
      where: { userId, leftAt: null },
      include: {
        chat: {
          select: { id: true, type: true, name: true, avatarUrl: true },
        },
      },
    });
    return { ok: true, chats: memberships.map(m => m.chat) };
  });

  // POST /setCommands
  app.post<{ Body: { commands: { command: string; description: string }[] } }>(
    '/setCommands',
    async (request) => {
      const { botId } = request.user as any;
      await prisma.bot.update({ where: { id: botId }, data: { commands: request.body.commands } });
      await redis.del(`bot:auth:${botId}`);
      return { ok: true };
    }
  );

  // POST /leaveChat
  app.post<{ Body: { chatId: string } }>('/leaveChat', async (request, reply) => {
    const { userId } = request.user as any;
    const { chatId } = request.body;

    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
      select: { id: true },
    });
    if (!member) return reply.status(404).send({ error: 'NOT_IN_CHAT' });

    await prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { leftAt: new Date() },
    });

    return { ok: true };
  });
}
