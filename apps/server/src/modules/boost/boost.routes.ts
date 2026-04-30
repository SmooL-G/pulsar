import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { getIO } from '../../socket/index.js';
import {
  boostChat,
  getChatBoostInfo,
  getMyBoosts,
  BoostError,
  BOOST_COST,
  BOOST_DURATION_DAYS,
  LEVEL_THRESHOLDS,
} from './boost.service.js';

export async function boostRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.get('/config', async () => ({
    cost: BOOST_COST.toString(),
    durationDays: BOOST_DURATION_DAYS,
    thresholds: LEVEL_THRESHOLDS,
  }));

  app.get<{ Params: { chatId: string } }>('/:chatId', async (request, reply) => {
    try {
      return await getChatBoostInfo(request.params.chatId);
    } catch (err) {
      return reply.status(500).send({ error: 'INTERNAL', message: (err as Error).message });
    }
  });

  app.get('/my/list', async (request) => {
    return { boosts: await getMyBoosts(request.user!.userId) };
  });

  app.post<{ Params: { chatId: string } }>('/:chatId', async (request, reply) => {
    const userId = request.user!.userId;
    try {
      const result = await boostChat(userId, request.params.chatId);
      // Push the new state to everyone watching this chat so their UI
      // reflects the new level immediately.
      try {
        const io = getIO();
        io.to(`chat:${request.params.chatId}`).emit('chat:updated', {
          id: request.params.chatId,
          boostLevel: result.level,
          boostCount: result.activeCount,
        } as any);
      } catch { /* socket failure shouldn't roll the tx back */ }
      return result;
    } catch (err) {
      if (err instanceof BoostError) {
        const status = err.code === 'NOT_FOUND' ? 404
          : err.code === 'NOT_MEMBER' ? 403
          : 400;
        return reply.status(status).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
}
