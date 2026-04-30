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
                verificationLevel: true,
        role: true,
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
      return reply.status(400).send({ error: 'ALREADY_MEMBER', message: 'Already a member', chatId: chat.id });
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

  // Add members to group
  app.post<{ Params: { groupId: string } }>('/:groupId/members', async (request, reply) => {
    const userId = request.user!.userId;
    const { groupId } = request.params;
    const { userIds } = request.body as { userIds: string[] };

    if (!userIds?.length) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'No users provided' });
    }

    // Check requester is member of the group
    const requester = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: groupId, userId } },
    });
    if (!requester || requester.leftAt) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not a member of this group' });
    }

    const chat = await prisma.chat.findUnique({ where: { id: groupId } });
    if (!chat || chat.type !== 'GROUP') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Group not found' });
    }

    const added: string[] = [];
    for (const uid of userIds) {
      const existing = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: groupId, userId: uid } },
      });
      if (existing && !existing.leftAt) continue; // already member
      if (existing) {
        await prisma.chatMember.update({
          where: { id: existing.id },
          data: { leftAt: null, role: 'MEMBER' },
        });
      } else {
        await prisma.chatMember.create({
          data: { chatId: groupId, userId: uid, role: 'MEMBER' },
        });
      }
      added.push(uid);
    }

    return { success: true, added };
  });

  // Delete group (owner only)
  app.delete<{ Params: { groupId: string } }>('/:groupId', async (request, reply) => {
    const userId = request.user!.userId;
    const { groupId } = request.params;

    const chat = await prisma.chat.findUnique({ where: { id: groupId } });
    if (!chat || chat.type !== 'GROUP') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Group not found' });
    }
    if (chat.ownerId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only the owner can delete the group' });
    }

    // Delete all related data
    await prisma.$transaction([
      prisma.readReceipt.deleteMany({ where: { message: { chatId: groupId } } }),
      prisma.reaction.deleteMany({ where: { message: { chatId: groupId } } }),
      prisma.fileAttachment.deleteMany({ where: { message: { chatId: groupId } } }),
      prisma.message.deleteMany({ where: { chatId: groupId } }),
      prisma.chatMember.deleteMany({ where: { chatId: groupId } }),
      prisma.chat.delete({ where: { id: groupId } }),
    ]);

    return { success: true };
  });

  // Change member role
  const ROLE_HIERARCHY: Record<string, number> = {
    MEMBER: 0,
    AUTHOR: 1,
    MODERATOR: 2,
    ADMIN: 3,
    OWNER: 4,
  };

  app.patch<{ Params: { groupId: string; userId: string } }>(
    '/:groupId/members/:userId/role',
    async (request, reply) => {
      const requesterId = request.user!.userId;
      const { groupId, userId: targetUserId } = request.params;
      const { role: newRole } = request.body as { role: string };

      if (!['MEMBER', 'AUTHOR', 'MODERATOR', 'ADMIN'].includes(newRole)) {
        return reply.status(400).send({ error: 'INVALID', message: 'Invalid role' });
      }

      const chat = await prisma.chat.findUnique({ where: { id: groupId } });
      if (!chat || chat.type !== 'GROUP') {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Group not found' });
      }

      const requester = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: groupId, userId: requesterId } },
      });
      if (!requester || requester.leftAt) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not a member' });
      }

      const target = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: groupId, userId: targetUserId } },
      });
      if (!target || target.leftAt) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Target not found' });
      }

      const requesterLevel = ROLE_HIERARCHY[requester.role] ?? 0;
      const targetLevel = ROLE_HIERARCHY[target.role] ?? 0;
      const newLevel = ROLE_HIERARCHY[newRole] ?? 0;

      // Must be ADMIN+ to change roles, and can only change roles below own level
      if (requesterLevel < 3) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only admins can change roles' });
      }
      if (targetLevel >= requesterLevel) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot change role of equal or higher rank' });
      }
      if (newLevel >= requesterLevel) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot promote to own level or higher' });
      }

      await prisma.chatMember.update({
        where: { id: target.id },
        data: { role: newRole as any },
      });

      return { success: true, role: newRole };
    }
  );

  // Kick member from group
  app.delete<{ Params: { groupId: string; userId: string } }>(
    '/:groupId/members/:userId',
    async (request, reply) => {
      const requesterId = request.user!.userId;
      const { groupId, userId: targetUserId } = request.params;

      if (requesterId === targetUserId) {
        return reply.status(400).send({ error: 'INVALID', message: 'Cannot kick yourself' });
      }

      const chat = await prisma.chat.findUnique({ where: { id: groupId } });
      if (!chat || chat.type !== 'GROUP') {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Group not found' });
      }

      const requester = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: groupId, userId: requesterId } },
      });
      if (!requester || requester.leftAt) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not a member' });
      }

      const target = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: groupId, userId: targetUserId } },
      });
      if (!target || target.leftAt) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Target not found' });
      }

      const requesterLevel = ROLE_HIERARCHY[requester.role] ?? 0;
      const targetLevel = ROLE_HIERARCHY[target.role] ?? 0;

      // Moderators+ can kick, but only lower ranks
      if (requesterLevel < 2) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
      }
      if (targetLevel >= requesterLevel) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot kick equal or higher rank' });
      }

      await prisma.chatMember.update({
        where: { id: target.id },
        data: { leftAt: new Date() },
      });

      return { success: true };
    }
  );

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
            verificationLevel: true,
        role: true,
          },
        },
      },
      orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
    });

    return { members };
  });
}
