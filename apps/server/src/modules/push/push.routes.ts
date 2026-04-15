import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { getPublicVapidKey } from './push.service.js';

export async function pushRoutes(app: FastifyInstance) {
  // Public — frontend needs the VAPID public key to subscribe
  app.get('/vapid-key', async () => {
    return { publicKey: getPublicVapidKey() };
  });

  app.register(async (scoped) => {
    scoped.addHook('preHandler', authMiddleware);

    // POST /push/subscribe — register a browser subscription
    scoped.post<{
      Body: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string };
    }>('/subscribe', async (request, reply) => {
      const userId = request.user!.userId;
      const { endpoint, keys, userAgent } = request.body;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return reply.status(400).send({ error: 'INVALID_SUBSCRIPTION' });
      }

      const sub = await prisma.pushSubscription.upsert({
        where: { endpoint },
        create: {
          userId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent: userAgent?.slice(0, 256),
        },
        update: {
          userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          lastUsedAt: new Date(),
        },
      });

      return { ok: true, id: sub.id };
    });

    // POST /push/unsubscribe — remove a subscription
    scoped.post<{ Body: { endpoint: string } }>('/unsubscribe', async (request) => {
      const userId = request.user!.userId;
      const { endpoint } = request.body;
      if (!endpoint) return { ok: true };

      await prisma.pushSubscription
        .deleteMany({ where: { endpoint, userId } })
        .catch(() => {});
      return { ok: true };
    });
  });
}
