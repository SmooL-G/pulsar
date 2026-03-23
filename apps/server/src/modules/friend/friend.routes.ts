import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';

export async function friendRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Get friends list (accepted)
  app.get('/', async (request) => {
    const userId = request.user!.userId;

    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true, lastSeenAt: true },
        },
        addressee: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true, lastSeenAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const friends = friendships.map((f) => {
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      return { ...friend, friendshipId: f.id };
    });

    return { friends };
  });

  // Get pending requests (incoming)
  app.get('/requests', async (request) => {
    const userId = request.user!.userId;

    const incoming = await prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: {
        requester: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const outgoing = await prisma.friendship.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      include: {
        addressee: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isOnline: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      incoming: incoming.map((r) => ({ id: r.id, user: r.requester, createdAt: r.createdAt })),
      outgoing: outgoing.map((r) => ({ id: r.id, user: r.addressee, createdAt: r.createdAt })),
    };
  });

  // Send friend request
  app.post('/request', async (request, reply) => {
    const userId = request.user!.userId;
    const { targetUserId } = request.body as { targetUserId: string };

    if (userId === targetUserId) {
      return reply.status(400).send({ error: 'INVALID_REQUEST', message: 'Cannot add yourself' });
    }

    // Check if friendship already exists in either direction
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: targetUserId },
          { requesterId: targetUserId, addresseeId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return reply.status(400).send({ error: 'ALREADY_FRIENDS', message: 'Already friends' });
      }
      if (existing.status === 'PENDING') {
        // If the other person already sent us a request, accept it
        if (existing.requesterId === targetUserId) {
          const updated = await prisma.friendship.update({
            where: { id: existing.id },
            data: { status: 'ACCEPTED' },
          });
          return { friendship: updated, autoAccepted: true };
        }
        return reply.status(400).send({ error: 'ALREADY_SENT', message: 'Request already sent' });
      }
      if (existing.status === 'DECLINED') {
        // Allow re-sending after decline
        const updated = await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'PENDING', requesterId: userId, addresseeId: targetUserId },
        });
        return reply.status(201).send({ friendship: updated });
      }
      if (existing.status === 'BLOCKED') {
        return reply.status(403).send({ error: 'BLOCKED', message: 'Cannot send request' });
      }
    }

    const friendship = await prisma.friendship.create({
      data: { requesterId: userId, addresseeId: targetUserId },
    });

    return reply.status(201).send({ friendship });
  });

  // Accept friend request
  app.post<{ Params: { id: string } }>('/:id/accept', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const friendship = await prisma.friendship.findUnique({ where: { id } });
    if (!friendship || friendship.addresseeId !== userId || friendship.status !== 'PENDING') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Request not found' });
    }

    const updated = await prisma.friendship.update({
      where: { id },
      data: { status: 'ACCEPTED' },
    });

    return { friendship: updated };
  });

  // Decline friend request
  app.post<{ Params: { id: string } }>('/:id/decline', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const friendship = await prisma.friendship.findUnique({ where: { id } });
    if (!friendship || friendship.addresseeId !== userId || friendship.status !== 'PENDING') {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Request not found' });
    }

    const updated = await prisma.friendship.update({
      where: { id },
      data: { status: 'DECLINED' },
    });

    return { friendship: updated };
  });

  // Remove friend
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const friendship = await prisma.friendship.findUnique({ where: { id } });
    if (!friendship) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Not found' });
    }
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Not your friendship' });
    }

    await prisma.friendship.delete({ where: { id } });
    return { success: true };
  });
}
