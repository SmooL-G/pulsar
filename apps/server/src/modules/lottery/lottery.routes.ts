import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import {
  MAIN_PRIZE,
  SMALL_PRIZE,
  MIN_COMMUNITY_SIZE,
  MIN_VERIFICATION_LEVEL,
  WIN_COOLDOWN_DAYS,
  isLotteryEnabled,
  setLotteryEnabled,
} from './lottery.service.js';

export async function lotteryRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // Static config + last 30 draws for the widget.
  app.get('/recent', async () => {
    const draws = await prisma.lotteryDraw.findMany({
      orderBy: { drawnAt: 'desc' },
      take: 30,
      select: {
        id: true,
        pool: true,
        amount: true,
        candidatesCount: true,
        drawnAt: true,
        winnerId: true,
      },
    });
    // Hydrate winner usernames in one go.
    const ids = Array.from(new Set(draws.map((d) => d.winnerId)));
    const winners = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, username: true, displayName: true, avatarUrl: true, nickColor: true },
        })
      : [];
    const winnerMap = new Map(winners.map((w) => [w.id, w]));

    return {
      enabled: await isLotteryEnabled(),
      mainPrize: MAIN_PRIZE.toString(),
      smallPrize: SMALL_PRIZE.toString(),
      minCommunitySize: MIN_COMMUNITY_SIZE,
      minVerificationLevel: MIN_VERIFICATION_LEVEL,
      cooldownDays: WIN_COOLDOWN_DAYS,
      draws: draws.map((d) => ({
        id: d.id,
        pool: d.pool,
        amount: d.amount.toString(),
        candidatesCount: d.candidatesCount,
        drawnAt: d.drawnAt.toISOString(),
        winner: winnerMap.get(d.winnerId) ?? null,
      })),
    };
  });

  // Admin-only: enable/disable the lottery worker. Disable stops new draws
  // immediately; in-flight draws (already-credited) are not undone.
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
    await setLotteryEnabled(enabled);
    return { enabled };
  });
}
