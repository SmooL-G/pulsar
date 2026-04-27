import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import {
  isRevenueEnabled,
  setRevenueEnabled,
  MEMBERS_PER_PLS,
  MIN_VERIFIED_MEMBERS,
  MAX_CHATS_PER_OWNER,
} from './revenue.service.js';

export async function revenueRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // Status + recent distributions for admin dashboard.
  app.get('/status', async () => {
    const recent = await prisma.revenueDistribution.findMany({
      orderBy: { distributedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        chatId: true,
        ownerId: true,
        amount: true,
        activeCount: true,
        distributedAt: true,
      },
    });
    const chatIds = Array.from(new Set(recent.map((r) => r.chatId)));
    const chats = chatIds.length
      ? await prisma.chat.findMany({
          where: { id: { in: chatIds } },
          select: { id: true, name: true, type: true },
        })
      : [];
    const chatMap = new Map(chats.map((c) => [c.id, c]));

    return {
      enabled: await isRevenueEnabled(),
      membersPerPls: MEMBERS_PER_PLS,
      minVerifiedMembers: MIN_VERIFIED_MEMBERS,
      maxChatsPerOwner: MAX_CHATS_PER_OWNER,
      recent: recent.map((r) => ({
        id: r.id,
        amount: r.amount.toString(),
        activeCount: r.activeCount,
        distributedAt: r.distributedAt.toISOString(),
        chat: chatMap.get(r.chatId) ?? null,
      })),
    };
  });

  app.post<{ Body: { enabled: boolean } }>('/toggle', async (request, reply) => {
    const userId = request.user!.userId;
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (me?.role !== 'ADMIN' && me?.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }
    const enabled = !!request.body?.enabled;
    await setRevenueEnabled(enabled);
    return { enabled };
  });
}
