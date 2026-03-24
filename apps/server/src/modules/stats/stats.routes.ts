import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';

export async function statsRoutes(app: FastifyInstance) {
  // Public endpoint — no auth required
  app.get('/public', async () => {
    // Cache in Redis for 60 seconds
    const cached = await redis.get('stats:public');
    if (cached) return JSON.parse(cached);

    const [userCount, onlineCount] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'ACTIVE', isOnline: true } }),
    ]);

    const result = { userCount, onlineCount, ts: Date.now() };
    await redis.set('stats:public', JSON.stringify(result), 'EX', 60);

    return result;
  });
}
