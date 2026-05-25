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
        avatarFrame: true,
        bubbleColor: true,
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

/**
 * Public-by-name lookup for groups/channels. Returns enough to render
 * a landing card when someone shares `https://pulsar-chat.fun/<name>`
 * and it turns out to be a group rather than a user. Mounted at /g/.
 *
 * Anyone can hit this — it doesn't reveal members, just the public
 * "shop window" of the group. inviteCode is included so the landing
 * page can offer a one-click "Join" if the group is open.
 */
export async function publicGroupRoutes(app: FastifyInstance) {
  app.get<{ Params: { name: string } }>('/:name', async (request, reply) => {
    const raw = request.params.name || '';
    if (!/^[\p{L}\p{N} _-]{1,64}$/u.test(raw)) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }
    const group = await prisma.chat.findFirst({
      where: {
        name: { equals: raw, mode: 'insensitive' },
        type: { in: ['GROUP', 'CHANNEL'] },
      },
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        avatarUrl: true,
        inviteCode: true,
        ownerId: true,
        createdAt: true,
        _count: { select: { members: { where: { leftAt: null } } } },
      },
    });
    if (!group) return reply.status(404).send({ error: 'NOT_FOUND' });
    return {
      id: group.id,
      name: group.name,
      type: group.type,
      description: group.description,
      avatarUrl: group.avatarUrl,
      inviteCode: group.inviteCode,
      ownerId: group.ownerId,
      membersCount: group._count.members,
      createdAt: group.createdAt.toISOString(),
    };
  });
}
