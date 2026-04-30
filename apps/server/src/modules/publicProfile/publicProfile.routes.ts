import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';

/**
 * Public-by-username lookup. Returns only the fields safe to show on
 * an unauthenticated landing page (no email, wallet, role, settings).
 * Used by the universal share-link `https://pulsar-chat.fun/:username`.
 */
export async function publicProfileRoutes(app: FastifyInstance) {
  app.get<{ Params: { username: string } }>('/:username', async (request, reply) => {
    const raw = request.params.username || '';
    // Username sanity: ascii alnum/underscore/dash, 2..32. Anything else
    // → 404 fast (cheap rejection of brute-force probes).
    if (!/^[A-Za-z0-9_-]{2,32}$/.test(raw)) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }
    const user = await prisma.user.findFirst({
      where: { username: { equals: raw, mode: 'insensitive' }, status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isBot: true,
        role: true, // Needed so the founder badge renders for SUPER_ADMIN
        verificationLevel: true,
        profileBadge: true,
        nickColor: true,
        createdAt: true,
      },
    });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
    };
  });
}
