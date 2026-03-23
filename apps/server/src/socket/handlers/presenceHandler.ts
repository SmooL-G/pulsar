import type { Server, Socket } from 'socket.io';
import { redis } from '../../config/redis.js';
import { prisma } from '../../config/database.js';

const PRESENCE_TTL = 60; // seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export function registerPresenceHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  // Set online on connect
  setOnline(userId, socket.id);

  socket.on('presence:heartbeat', () => {
    redis.setex(`user:online:${userId}`, PRESENCE_TTL, '1');
  });

  socket.on('disconnect', async () => {
    // Remove this socket from user's socket set
    await redis.srem(`user:sockets:${userId}`, socket.id);
    const remaining = await redis.scard(`user:sockets:${userId}`);

    if (remaining === 0) {
      // No more active sockets — user is offline
      await redis.del(`user:online:${userId}`);
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: false, lastSeenAt: new Date() },
      });

      io.emit('presence:update', { userId, isOnline: false });
    }
  });
}

async function setOnline(userId: string, socketId: string) {
  await redis.sadd(`user:sockets:${userId}`, socketId);
  await redis.setex(`user:online:${userId}`, PRESENCE_TTL, '1');
  await prisma.user.update({
    where: { id: userId },
    data: { isOnline: true },
  });
}
