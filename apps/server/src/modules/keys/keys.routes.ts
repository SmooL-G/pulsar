import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/auth.js';

export async function keysRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // POST /keys/bundle — загрузить свой key bundle
  app.post<{
    Body: { identityKeyPub: string; preKeyPub: string; preKeySignature: string };
  }>('/bundle', async (request, reply) => {
    const { identityKeyPub, preKeyPub, preKeySignature } = request.body;

    if (!identityKeyPub || !preKeyPub || !preKeySignature) {
      return reply.status(400).send({ error: 'MISSING_KEYS', message: 'All key fields required' });
    }

    const bundle = await prisma.userKeyBundle.upsert({
      where: { userId: request.user!.userId },
      create: {
        userId: request.user!.userId,
        identityKeyPub,
        preKeyPub,
        preKeySignature,
      },
      update: {
        identityKeyPub,
        preKeyPub,
        preKeySignature,
      },
    });

    return { success: true, bundle: { id: bundle.id, identityKeyPub: bundle.identityKeyPub, preKeyPub: bundle.preKeyPub } };
  });

  // GET /keys/bundle/:userId — получить key bundle другого пользователя
  app.get<{ Params: { userId: string } }>('/bundle/:userId', async (request, reply) => {
    const bundle = await prisma.userKeyBundle.findUnique({
      where: { userId: request.params.userId },
      select: {
        identityKeyPub: true,
        preKeyPub: true,
        preKeySignature: true,
      },
    });

    if (!bundle) {
      return reply.status(404).send({ error: 'NO_KEY_BUNDLE', message: 'User has no key bundle' });
    }

    return { bundle };
  });

  // GET /keys/my-bundle — проверить есть ли у меня key bundle
  app.get('/my-bundle', async (request) => {
    const bundle = await prisma.userKeyBundle.findUnique({
      where: { userId: request.user!.userId },
      select: { identityKeyPub: true, preKeyPub: true, createdAt: true },
    });

    return { hasBundle: !!bundle, bundle };
  });
}
