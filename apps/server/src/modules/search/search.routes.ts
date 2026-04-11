import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';

export async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Universal search: users, public groups, public channels, bots
  app.get('/', async (request) => {
    const { q, limit = 20 } = request.query as { q?: string; limit?: number };

    if (!q || q.length < 2) {
      return { users: [], groups: [], channels: [], bots: [] };
    }

    const take = Math.min(Number(limit), 20);
    const search = { contains: q, mode: 'insensitive' as const };

    // Search in parallel
    const [users, groups, channels, bots] = await Promise.all([
      // Users (non-bot, active)
      prisma.user.findMany({
        where: {
          OR: [
            { username: search },
            { displayName: search },
          ],
          status: 'ACTIVE',
          isBot: false,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isOnline: true,
          verificationLevel: true,
          profileBadge: true,
        },
        take,
      }),

      // Public groups
      prisma.chat.findMany({
        where: {
          type: 'GROUP',
          isPublic: true,
          OR: [
            { name: search },
            { description: search },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          avatarUrl: true,
          inviteCode: true,
          _count: { select: { members: true } },
        },
        take,
      }),

      // Public channels
      prisma.chat.findMany({
        where: {
          type: 'CHANNEL',
          isPublic: true,
          OR: [
            { name: search },
            { description: search },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          avatarUrl: true,
          inviteCode: true,
          _count: { select: { members: true } },
        },
        take,
      }),

      // Bots
      prisma.user.findMany({
        where: {
          OR: [
            { username: search },
            { displayName: search },
          ],
          status: 'ACTIVE',
          isBot: true,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isOnline: true,
        },
        take,
      }),
    ]);

    return {
      users,
      groups: groups.map((g) => ({ ...g, memberCount: g._count.members })),
      channels: channels.map((c) => ({ ...c, memberCount: c._count.members })),
      bots,
    };
  });
}
