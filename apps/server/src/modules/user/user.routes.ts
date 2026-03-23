import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';

export async function userRoutes(app: FastifyInstance) {
  // All user routes require authentication
  app.addHook('preHandler', authMiddleware);

  // Search users
  app.get('/', async (request) => {
    const { q, limit = 20, offset = 0 } = request.query as {
      q?: string;
      limit?: number;
      offset?: number;
    };

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
            ],
            status: 'ACTIVE',
          }
        : { status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        walletAddress: true,
        isOnline: true,
        lastSeenAt: true,
      },
      take: Math.min(Number(limit), 50),
      skip: Number(offset),
    });

    return { users };
  });

  // Get user profile
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id, status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        walletAddress: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return user;
  });

  // Update own profile
  app.patch('/me', async (request) => {
    const { displayName, bio, avatarUrl } = request.body as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
    };

    const user = await prisma.user.update({
      where: { id: request.user!.userId },
      data: { displayName, bio, avatarUrl },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        walletAddress: true,
      },
    });

    return user;
  });
}
