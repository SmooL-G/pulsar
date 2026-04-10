import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { nanoid } from 'nanoid';
import { LIMITS } from '@pulsar/shared';

const ROLE_HIERARCHY: Record<string, number> = {
  MEMBER: 0,
  AUTHOR: 1,
  MODERATOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export async function channelRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Create channel
  app.post('/', async (request, reply) => {
    const userId = request.user!.userId;
    const { name, description, isPublic, allowComments } = request.body as {
      name: string;
      description?: string;
      isPublic?: boolean;
      allowComments?: boolean;
    };

    if (!name || name.length > LIMITS.GROUP_NAME_MAX) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid channel name' });
    }

    const channel = await prisma.chat.create({
      data: {
        type: 'CHANNEL',
        name,
        description,
        isPublic: isPublic ?? false,
        allowComments: allowComments ?? false,
        ownerId: userId,
        inviteCode: nanoid(LIMITS.INVITE_CODE_LENGTH),
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
    });

    return reply.status(201).send({ channel });
  });

  // Subscribe to public channel by ID (from search)
  app.post<{ Params: { channelId: string } }>('/:channelId/subscribe', async (request, reply) => {
    const userId = request.user!.userId;
    const { channelId } = request.params;

    const chat = await prisma.chat.findUnique({
      where: { id: channelId },
      include: { _count: { select: { members: { where: { leftAt: null } } } } },
    });

    if (!chat || chat.type !== 'CHANNEL') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Channel not found' });
    }
    if (chat._count.members >= chat.maxMembers) {
      return reply.status(400).send({ error: 'CHANNEL_FULL', message: 'Channel is full' });
    }

    const existing = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: channelId, userId } },
    });
    if (existing && !existing.leftAt) {
      return reply.status(400).send({ error: 'ALREADY_MEMBER', message: 'Already subscribed', chatId: channelId });
    }
    if (existing) {
      await prisma.chatMember.update({ where: { id: existing.id }, data: { leftAt: null, role: 'MEMBER' } });
    } else {
      await prisma.chatMember.create({ data: { chatId: channelId, userId, role: 'MEMBER' } });
    }

    return { success: true, chatId: channelId };
  });

  // Join via invite code
  app.post<{ Params: { inviteCode: string } }>('/join/:inviteCode', async (request, reply) => {
    const userId = request.user!.userId;
    const { inviteCode } = request.params;

    const chat = await prisma.chat.findUnique({
      where: { inviteCode },
      include: { _count: { select: { members: { where: { leftAt: null } } } } },
    });

    if (!chat || chat.type !== 'CHANNEL') {
      return reply.status(404).send({ error: 'INVALID_INVITE', message: 'Invalid invite code' });
    }

    if (chat._count.members >= chat.maxMembers) {
      return reply.status(400).send({ error: 'CHANNEL_FULL', message: 'Channel is full' });
    }

    const existing = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: chat.id, userId } },
    });

    if (existing && !existing.leftAt) {
      return reply.status(400).send({ error: 'ALREADY_MEMBER', message: 'Already subscribed', chatId: chat.id });
    }

    if (existing) {
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

  // Get channel info (member count only, no member list for regular members)
  app.get<{ Params: { channelId: string } }>('/:channelId', async (request, reply) => {
    const userId = request.user!.userId;
    const { channelId } = request.params;

    const chat = await prisma.chat.findUnique({
      where: { id: channelId },
      include: {
        _count: { select: { members: { where: { leftAt: null } } } },
      },
    });

    if (!chat || chat.type !== 'CHANNEL') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Channel not found' });
    }

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: channelId, userId } },
    });

    const myRole = membership?.role ?? null;
    const isAdmin = (ROLE_HIERARCHY[myRole ?? ''] ?? 0) >= ROLE_HIERARCHY.ADMIN;

    return {
      channel: {
        id: chat.id,
        name: chat.name,
        description: chat.description,
        avatarUrl: chat.avatarUrl,
        inviteCode: isAdmin ? chat.inviteCode : undefined,
        ownerId: chat.ownerId,
        isPublic: chat.isPublic,
        allowComments: chat.allowComments,
        memberCount: chat._count.members,
        myRole,
      },
    };
  });

  // Update channel settings (owner/admin only)
  app.patch<{ Params: { channelId: string } }>('/:channelId', async (request, reply) => {
    const userId = request.user!.userId;
    const { channelId } = request.params;
    const { name, description, isPublic, allowComments } = request.body as {
      name?: string;
      description?: string;
      isPublic?: boolean;
      allowComments?: boolean;
    };

    const chat = await prisma.chat.findUnique({ where: { id: channelId } });
    if (!chat || chat.type !== 'CHANNEL') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Channel not found' });
    }

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: channelId, userId } },
    });
    if (!membership || (ROLE_HIERARCHY[membership.role] ?? 0) < ROLE_HIERARCHY.ADMIN) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only admins can update channel settings' });
    }

    const updated = await prisma.chat.update({
      where: { id: channelId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
        ...(allowComments !== undefined && { allowComments }),
      },
    });

    return { success: true, channel: updated };
  });

  // Change member role (admin+ only)
  app.patch<{ Params: { channelId: string; userId: string } }>(
    '/:channelId/members/:userId/role',
    async (request, reply) => {
      const requesterId = request.user!.userId;
      const { channelId, userId: targetUserId } = request.params;
      const { role: newRole } = request.body as { role: string };

      if (!['MEMBER', 'AUTHOR', 'MODERATOR', 'ADMIN'].includes(newRole)) {
        return reply.status(400).send({ error: 'INVALID', message: 'Invalid role' });
      }

      const chat = await prisma.chat.findUnique({ where: { id: channelId } });
      if (!chat || chat.type !== 'CHANNEL') {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Channel not found' });
      }

      const requester = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: channelId, userId: requesterId } },
      });
      if (!requester || requester.leftAt || (ROLE_HIERARCHY[requester.role] ?? 0) < ROLE_HIERARCHY.ADMIN) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
      }

      const target = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: channelId, userId: targetUserId } },
      });
      if (!target || target.leftAt) {
        return reply.status(404).send({ error: 'NOT_FOUND', message: 'Member not found' });
      }

      const requesterLevel = ROLE_HIERARCHY[requester.role] ?? 0;
      const targetLevel = ROLE_HIERARCHY[target.role] ?? 0;
      const newLevel = ROLE_HIERARCHY[newRole] ?? 0;

      if (targetLevel >= requesterLevel || newLevel >= requesterLevel) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot change role of equal or higher rank' });
      }

      await prisma.chatMember.update({
        where: { id: target.id },
        data: { role: newRole as any },
      });

      return { success: true, role: newRole };
    }
  );
}
