import type { Server, Socket } from 'socket.io';
import { prisma } from '../../config/database.js';

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;

async function fetchLinkPreview(url: string): Promise<{ title?: string; description?: string; image?: string; siteName?: string; url: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PulsarBot/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;

    const html = await res.text();
    // Only parse first 50KB
    const head = html.slice(0, 50000);

    const getOg = (prop: string) => {
      const m = head.match(new RegExp(`<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || head.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${prop}["']`, 'i'));
      return m?.[1];
    };

    const getTitle = () => {
      const m = head.match(/<title[^>]*>([^<]+)<\/title>/i);
      return m?.[1]?.trim();
    };

    const getMeta = (name: string) => {
      const m = head.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || head.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'));
      return m?.[1];
    };

    const title = getOg('title') || getTitle();
    const description = getOg('description') || getMeta('description');
    const image = getOg('image');
    const siteName = getOg('site_name');

    if (!title && !description && !image) return null;

    // Resolve relative image URLs
    let resolvedImage = image;
    if (image && !image.startsWith('http')) {
      try {
        resolvedImage = new URL(image, url).href;
      } catch { resolvedImage = undefined; }
    }

    return { title, description: description?.slice(0, 200), image: resolvedImage, siteName, url };
  } catch {
    return null;
  }
}

export function registerMessageHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on('message:send', async (data) => {
    try {
      // Determine message type based on attachments
      const hasAttachments = data.attachments && data.attachments.length > 0;
      let msgType = (data.type as 'TEXT' | 'FILE' | 'IMAGE' | 'SYSTEM') || 'TEXT';
      if (hasAttachments && msgType === 'TEXT') {
        const firstMime = data.attachments[0]?.mimeType || '';
        msgType = firstMime.startsWith('image/') ? 'IMAGE' : 'FILE';
      }

      const message = await prisma.message.create({
        data: {
          chatId: data.chatId,
          senderId: userId,
          content: data.content,
          type: msgType,
          replyToId: data.replyToId,
          signature: data.signature || null,
          signerWallet: data.signerWallet || null,
          encryptedContent: data.encryptedContent || null,
          encryptionType: data.encryptedContent ? 'nacl-box' : null,
          commentsEnabled: data.commentsEnabled || false,
          // Create file attachments if provided
          ...(hasAttachments && {
            attachments: {
              create: data.attachments.map((a: any) => ({
                uploaderId: userId,
                fileName: a.fileName,
                fileSize: BigInt(a.fileSize),
                mimeType: a.mimeType,
                s3Key: a.url,
                s3Bucket: 'pulsar-files',
              })),
            },
          }),
        },
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
              width: true,
              height: true,
            },
          },
        },
      });

      // Check how many other sockets are in the chat room (for delivery status)
      const roomSockets = await io.in(`chat:${data.chatId}`).fetchSockets();
      const otherInRoom = roomSockets.some((s) => s.data.userId !== userId);
      const status = otherInRoom ? 'delivered' : 'sent';

      const messagePayload = {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        replyToId: message.replyToId,
        isEdited: message.isEdited,
        isDeleted: message.isDeleted,
        metadata: message.metadata as Record<string, unknown> | null,
        signature: message.signature,
        signerWallet: message.signerWallet,
        encryptedContent: message.encryptedContent,
        encryptionType: message.encryptionType,
        commentsEnabled: message.commentsEnabled,
        commentChatId: message.commentChatId,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        sender: message.sender,
        attachments: message.attachments?.map((a: any) => ({
          id: a.id,
          fileName: a.fileName,
          fileSize: Number(a.fileSize),
          mimeType: a.mimeType,
          url: a.s3Key,
          width: a.width,
          height: a.height,
        })),
        status,
      };

      // Broadcast to all members of the chat
      io.to(`chat:${data.chatId}`).emit('message:new', messagePayload);

      // Push notifications to chat members who don't have the chat open right now
      (async () => {
        try {
          const recipients = await prisma.chatMember.findMany({
            where: {
              chatId: data.chatId,
              leftAt: null,
              NOT: { userId },
              user: { isBot: false },
            },
            select: { userId: true },
          });
          if (recipients.length === 0) return;

          // Build set of userIds currently focused on this chat (have a socket in the room)
          const activeUserIds = new Set(roomSockets.map((s) => s.data.userId).filter(Boolean));
          const targets = recipients.map((r) => r.userId).filter((id) => !activeUserIds.has(id));
          if (targets.length === 0) return;

          const chat = await prisma.chat.findUnique({
            where: { id: data.chatId },
            select: { name: true, type: true },
          });
          const senderName =
            (message.sender as any)?.displayName || (message.sender as any)?.username || 'Someone';
          const isDM = chat?.type === 'DIRECT';
          const title = isDM ? senderName : `${senderName} · ${chat?.name || 'group'}`;
          const preview =
            (data.content || '').slice(0, 140) ||
            (data.attachments?.length ? '📎 attachment' : '');

          const { sendPushToUsers } = await import('../../modules/push/push.service.js');
          await sendPushToUsers(targets, {
            title,
            body: preview,
            url: `/?chat=${data.chatId}`,
            tag: `chat:${data.chatId}`,
          });
        } catch (err) {
          console.error('[push] dispatch error:', err);
        }
      })();

      // Dispatch to bots in the chat (PulsarBot system handler + user bot webhooks)
      if (data.content) {
        (async () => {
          try {
            const { PULSAR_BOT_USER_ID } = await import('../../modules/bot/pulsarBot.seed.js');
            const botMembers = await prisma.chatMember.findMany({
              where: {
                chatId: data.chatId,
                leftAt: null,
                NOT: { userId },
                user: { isBot: true },
              },
              select: { userId: true },
            });
            const hasPulsarBot = botMembers.some((m) => m.userId === PULSAR_BOT_USER_ID);
            if (hasPulsarBot && PULSAR_BOT_USER_ID) {
              const { handlePulsarBotMessage } = await import('../../modules/bot/pulsarBot.handler.js');
              await handlePulsarBotMessage(userId, data.chatId, data.content);
            }
            // Dispatch to user bots (webhooks + long-poll queue)
            const { dispatchBotUpdates } = await import('../../modules/bot/webhook.service.js');
            await dispatchBotUpdates(messagePayload as any);
          } catch (err) {
            console.error('[bot dispatch] error:', err);
          }
        })();
      }

      // Async: fetch link preview if message contains URLs
      if (data.content) {
        const urls = data.content.match(URL_REGEX);
        if (urls && urls.length > 0) {
          // Fetch preview for first URL only
          fetchLinkPreview(urls[0]).then(async (preview) => {
            if (!preview) return;
            try {
              await prisma.message.update({
                where: { id: message.id },
                data: { metadata: { linkPreview: preview } },
              });
              io.to(`chat:${data.chatId}`).emit('message:updated', {
                ...messagePayload,
                metadata: { linkPreview: preview },
              });
            } catch { /* ignore */ }
          });
        }
      }
    } catch (error) {
      socket.emit('error', {
        code: 'MESSAGE_SEND_FAILED',
        message: 'Failed to send message',
      });
    }
  });

  socket.on('message:edit', async (data) => {
    try {
      const message = await prisma.message.update({
        where: { id: data.messageId, senderId: userId },
        data: { content: data.content, isEdited: true },
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
        },
      });

      io.to(`chat:${message.chatId}`).emit('message:updated', {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        replyToId: message.replyToId,
        isEdited: message.isEdited,
        isDeleted: message.isDeleted,
        metadata: message.metadata as Record<string, unknown> | null,
        signature: message.signature,
        signerWallet: message.signerWallet,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        sender: message.sender,
      });
    } catch {
      socket.emit('error', { code: 'MESSAGE_EDIT_FAILED', message: 'Failed to edit message' });
    }
  });

  socket.on('message:delete', async (data) => {
    try {
      const message = await prisma.message.update({
        where: { id: data.messageId, senderId: userId },
        data: { isDeleted: true, content: null },
      });

      io.to(`chat:${message.chatId}`).emit('message:deleted', {
        messageId: message.id,
        chatId: message.chatId,
      });
    } catch {
      socket.emit('error', { code: 'MESSAGE_DELETE_FAILED', message: 'Failed to delete message' });
    }
  });

  socket.on('message:read', async (data) => {
    try {
      await prisma.readReceipt.upsert({
        where: {
          messageId_userId: {
            messageId: data.messageId,
            userId,
          },
        },
        create: { messageId: data.messageId, userId },
        update: { readAt: new Date() },
      });

      io.to(`chat:${data.chatId}`).emit('message:read', {
        chatId: data.chatId,
        messageId: data.messageId,
        userId,
      });
    } catch {
      // Silently fail for read receipts
    }
  });
}
