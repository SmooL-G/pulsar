import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';

export async function userRoutes(app: FastifyInstance) {
  // All user routes require authentication
  app.addHook('preHandler', authMiddleware);

  // Search users
  app.get('/', async (request) => {
    const { q, search, limit = 20, offset = 0 } = request.query as {
      q?: string;
      search?: string;
      limit?: number;
      offset?: number;
    };
    const query = q || search;

    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { displayName: { contains: query, mode: 'insensitive' } },
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
        verificationLevel: true,
        profileBadge: true,
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
        verificationLevel: true,
        socialLinks: true,
        profileBadge: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return user;
  });

  // Update own profile
  app.patch('/me', async (request) => {
    const { displayName, bio, avatarUrl, socialLinks } = request.body as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      socialLinks?: Record<string, string>;
    };

    // Sanitize socialLinks — only allow known keys
    let cleanLinks: Record<string, string> | undefined;
    if (socialLinks && typeof socialLinks === 'object') {
      const allowed = ['telegram', 'twitter', 'youtube', 'instagram', 'github', 'website'];
      cleanLinks = {};
      for (const key of allowed) {
        if (socialLinks[key] && typeof socialLinks[key] === 'string') {
          cleanLinks[key] = socialLinks[key].trim().slice(0, 200);
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: request.user!.userId },
      data: {
        displayName,
        bio,
        avatarUrl,
        ...(cleanLinks !== undefined ? { socialLinks: cleanLinks } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        walletAddress: true,
        verificationLevel: true,
        socialLinks: true,
        profileBadge: true,
      },
    });

    return user;
  });
}
