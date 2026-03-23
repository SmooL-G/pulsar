import type { Server, Socket } from 'socket.io';
import { prisma } from '../../config/database.js';

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
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Broadcast to all members of the chat
      io.to(`chat:${data.chatId}`).emit('message:new', {
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        content: message.content,
        type: message.type,
        replyToId: message.replyToId,
        isEdited: message.isEdited,
        isDeleted: message.isDeleted,
        metadata: message.metadata as Record<string, unknown> | null,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        sender: message.sender,
      });
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
