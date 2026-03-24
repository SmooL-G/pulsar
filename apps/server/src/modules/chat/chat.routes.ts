import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // List user's chats
  app.get('/', async (request) => {
    const userId = request.user!.userId;

    const memberships = await prisma.chatMember.findMany({
      where: { userId, leftAt: null },
      include: {
        chat: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: { username: true, displayName: true },
                },
              },
            },
            members: {
              where: { leftAt: null },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    isOnline: true,
                  },
                },
              },
            },
            _count: { select: { members: { where: { leftAt: null } } } },
          },
        },
      },
      orderBy: { chat: { updatedAt: 'desc' } },
    });

    const chats = memberships.map((m) => {
      const lastMessage = m.chat.messages[0];
      return {
        id: m.chat.id,
        type: m.chat.type,
        name: m.chat.name,
        avatarUrl: m.chat.avatarUrl,
        isPublic: m.chat.isPublic,
        inviteCode: m.chat.inviteCode,
        ownerId: m.chat.ownerId,
        memberCount: m.chat._count.members,
        myRole: m.role,
        updatedAt: m.chat.updatedAt.toISOString(),
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt.toISOString(),
              sender: lastMessage.sender,
            }
          : null,
        // For DMs, include the other user's info
        otherUser:
          m.chat.type === 'DIRECT'
            ? m.chat.members.find((member) => member.userId !== userId)?.user
            : null,
      };
    });

    return { chats };
  });

  // Delete / leave chat
  app.delete<{ Params: { chatId: string } }>('/:chatId', async (request, reply) => {
    const userId = request.user!.userId;
    const { chatId } = request.params;

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership || membership.leftAt) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Chat not found' });
    }

    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Chat not found' });
    }

    if (chat.type === 'DIRECT') {
      // For DMs: leave (soft delete)
      await prisma.chatMember.update({
        where: { id: membership.id },
        data: { leftAt: new Date() },
      });
    } else if (chat.type === 'GROUP') {
      if (chat.ownerId === userId) {
        // Owner deletes entire group
        await prisma.$transaction([
          prisma.readReceipt.deleteMany({ where: { message: { chatId } } }),
          prisma.reaction.deleteMany({ where: { message: { chatId } } }),
          prisma.fileAttachment.deleteMany({ where: { message: { chatId } } }),
          prisma.message.deleteMany({ where: { chatId } }),
          prisma.chatMember.deleteMany({ where: { chatId } }),
          prisma.chat.delete({ where: { id: chatId } }),
        ]);
      } else {
        // Member leaves group
        await prisma.chatMember.update({
          where: { id: membership.id },
          data: { leftAt: new Date() },
        });
      }
    }

    return { success: true };
  });

  // Clear chat history (for current user)
  app.delete<{ Params: { chatId: string } }>('/:chatId/messages', async (request, reply) => {
    const userId = request.user!.userId;
    const { chatId } = request.params;

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership || membership.leftAt) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Chat not found' });
    }

    // Delete all messages in this chat sent by this user
    // For now, clear all messages (full clear)
    await prisma.$transaction([
      prisma.readReceipt.deleteMany({ where: { message: { chatId } } }),
      prisma.reaction.deleteMany({ where: { message: { chatId } } }),
      prisma.fileAttachment.deleteMany({ where: { message: { chatId } } }),
      prisma.message.deleteMany({ where: { chatId } }),
    ]);

    return { success: true };
  });

  // Create or get DM chat
  app.post('/direct', async (request, reply) => {
    const userId = request.user!.userId;
    const { targetUserId } = request.body as { targetUserId: string };

    if (userId === targetUserId) {
      return reply.status(400).send({ error: 'INVALID_REQUEST', message: 'Cannot chat with yourself' });
    }

    // Check if DM already exists between these users
    const existing = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId, leftAt: null } } },
          { members: { some: { userId: targetUserId, leftAt: null } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isOnline: true,
              },
            },
          },
        },
      },
    });

    if (existing) {
      return { chat: existing };
    }

    // Create new DM
    const chat = await prisma.chat.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [
            { userId, role: 'MEMBER' },
            { userId: targetUserId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isOnline: true,
              },
            },
          },
        },
      },
    });

    return reply.status(201).send({ chat });
  });
}
