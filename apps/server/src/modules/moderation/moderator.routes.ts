import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';

const REQUIREMENTS = {
  accountAgeDays: 30,
  messageCount: 500,
  verificationLevel: 1,
  noPunishmentDays: 90,
  invitedMembers: 5,
};

async function checkRequirements(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      verificationLevel: true,
      role: true,
    },
  });

  if (!user) return null;

  const now = new Date();

  // 1. Account age
  const accountAgeDays = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const accountAge = { value: accountAgeDays, required: REQUIREMENTS.accountAgeDays, met: accountAgeDays >= REQUIREMENTS.accountAgeDays };

  // 2. Message count
  const msgCount = await prisma.message.count({ where: { senderId: userId, isDeleted: false } });
  const messages = { value: msgCount, required: REQUIREMENTS.messageCount, met: msgCount >= REQUIREMENTS.messageCount };

  // 3. Verification level
  const verification = { value: user.verificationLevel, required: REQUIREMENTS.verificationLevel, met: user.verificationLevel >= REQUIREMENTS.verificationLevel };

  // 4. No punishments in last 90 days
  const recentPunishments = await prisma.userPunishment.count({
    where: {
      userId,
      createdAt: { gte: new Date(now.getTime() - REQUIREMENTS.noPunishmentDays * 24 * 60 * 60 * 1000) },
    },
  });
  const noPunishments = { value: recentPunishments, required: 0, met: recentPunishments === 0 };

  // 5. Invited members (chats where user is owner with 2+ members)
  const ownedChats = await prisma.chat.findMany({
    where: { ownerId: userId },
    select: { id: true, _count: { select: { members: { where: { leftAt: null } } } } },
  });
  const totalInvited = ownedChats.reduce((sum, c) => sum + Math.max(0, c._count.members - 1), 0);
  const invited = { value: totalInvited, required: REQUIREMENTS.invitedMembers, met: totalInvited >= REQUIREMENTS.invitedMembers };

  const requirements = { accountAge, messages, verification, noPunishments, invited };
  const allMet = Object.values(requirements).every((r) => r.met);
  const metCount = Object.values(requirements).filter((r) => r.met).length;

  return {
    requirements,
    allMet,
    metCount,
    total: 5,
    currentRole: user.role,
    isAlreadyModerator: user.role === 'MODERATOR' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN',
  };
}

export async function moderatorRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /requirements — check progress toward moderator
  app.get('/requirements', async (request) => {
    const userId = request.user!.userId;
    const result = await checkRequirements(userId);
    if (!result) return { error: 'USER_NOT_FOUND' };
    return result;
  });

  // POST /apply — apply for moderator role
  app.post('/apply', async (request, reply) => {
    const userId = request.user!.userId;
    const result = await checkRequirements(userId);

    if (!result) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    if (result.isAlreadyModerator) return reply.status(400).send({ error: 'ALREADY_MODERATOR' });
    if (!result.allMet) {
      return reply.status(400).send({
        error: 'REQUIREMENTS_NOT_MET',
        message: `${result.metCount}/${result.total} requirements met`,
        requirements: result.requirements,
      });
    }

    // Auto-approve: set role to MODERATOR
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'MODERATOR' },
    });

    return { success: true, message: 'You are now a Moderator!' };
  });

  // POST /admin/moderators/:userId/approve — admin approves moderator (override)
  app.post('/admin/approve/:userId', async (request, reply) => {
    const adminId = request.user!.userId;
    const { userId } = request.params as { userId: string };

    // Check admin role
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, username: true },
    });
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    if (target.role === 'ADMIN' || target.role === 'SUPER_ADMIN') {
      return reply.status(400).send({ error: 'CANNOT_MODIFY_ADMIN' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: 'MODERATOR' },
    });

    return { success: true, username: target.username };
  });

  // POST /admin/revoke/:userId — revoke moderator role
  app.post('/admin/revoke/:userId', async (request, reply) => {
    const adminId = request.user!.userId;
    const { userId } = request.params as { userId: string };

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    });
    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN')) {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!target) return reply.status(404).send({ error: 'USER_NOT_FOUND' });
    if (target.role !== 'MODERATOR') {
      return reply.status(400).send({ error: 'NOT_A_MODERATOR' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { role: 'USER' },
    });

    return { success: true };
  });
}
