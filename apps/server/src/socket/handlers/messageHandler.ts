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
      const message = await prisma.message.create({
        data: {
          chatId: data.chatId,
          senderId: userId,
          content: data.content,
          type: (data.type as 'TEXT' | 'FILE' | 'IMAGE' | 'SYSTEM') || 'TEXT',
          replyToId: data.replyToId,
          signature: data.signature || null,
          signerWallet: data.signerWallet || null,
          encryptedContent: data.encryptedContent || null,
          encryptionType: data.encryptedContent ? 'nacl-box' : null,
          commentsEnabled: data.commentsEnabled || false,
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
        status,
      };

      // Broadcast to all members of the chat
      io.to(`chat:${data.chatId}`).emit('message:new', messagePayload);

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
