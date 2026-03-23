import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { nanoid } from 'nanoid';
import { LIMITS } from '@pulsar/shared';

export async function groupRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Create group
  app.post('/', async (request, reply) => {
    const userId = request.user!.userId;
    const { name, description, isPublic } = request.body as {
      name: string;
      description?: string;
      isPublic?: boolean;
    };

    if (!name || name.length > LIMITS.GROUP_NAME_MAX) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid group name' });
    }

    const group = await prisma.chat.create({
      data: {
        type: 'GROUP',
        name,
        description,
        isPublic: isPublic || false,
        ownerId: userId,
        inviteCode: nanoid(LIMITS.INVITE_CODE_LENGTH),
        members: {
          create: { userId, role: 'OWNER' },
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
              },
            },
          },
        },
      },
    });

    return reply.status(201).send({ group });
  });

  // Join via invite code
  app.post<{ Params: { inviteCode: string } }>('/join/:inviteCode', async (request, reply) => {
    const userId = request.user!.userId;
    const { inviteCode } = request.params;

    const chat = await prisma.chat.findUnique({
      where: { inviteCode },
      include: { _count: { select: { members: { where: { leftAt: null } } } } },
    });

    if (!chat) {
      return reply.status(404).send({ error: 'INVALID_INVITE', message: 'Invalid invite code' });
    }

    if (chat._count.members >= chat.maxMembers) {
      return reply.status(400).send({ error: 'GROUP_FULL', message: 'Group is full' });
    }

    // Check if already a member
    const existing = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: chat.id, userId } },
    });

    if (existing && !existing.leftAt) {
      return reply.status(400).send({ error: 'ALREADY_MEMBER', message: 'Already a member' });
    }

    if (existing) {
      // Re-join
      await prisma.chatMember.update({
        where: { id: existing.id },
        data: { leftAt: null, role: 'MEMBER' },
      });
    } else {
      await prisma.chatMember.create({
        data: { chatId: chat.id, userId, role: 'MEMBER' },
      });
    }

    return { success: true, chatId: chat.id };
  });

  // Get group members
  app.get<{ Params: { groupId: string } }>('/:groupId/members', async (request) => {
    const { groupId } = request.params;

    const members = await prisma.chatMember.findMany({
      where: { chatId: groupId, leftAt: null },
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
      orderBy: { joinedAt: 'asc' },
    });

    return { members };
  });
}
