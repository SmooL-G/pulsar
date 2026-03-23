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
              select: { username: true, displayName: true },
            },
          },
        },
      },
    });

    const nextCursor =
      messages.length === Number(limit)
        ? messages[messages.length - 1].createdAt.toISOString()
        : null;

    return {
      messages: messages.map((m) => ({
        ...m,
        fileSize: m.attachments.map((a) => ({
          ...a,
          fileSize: Number(a.fileSize),
        })),
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      nextCursor,
    };
  });
}
