import type { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import { redis } from '../../config/redis.js';
import { prisma } from '../../config/database.js';

const PRESENCE_TTL = 60;
const HEARTBEAT_INTERVAL = 30000;

const INSTANCE_ID = process.env.INSTANCE_ID || crypto.randomUUID();

let cleanedUp = false;
export async function cleanupPresenceOnStart() {
  if (cleanedUp) return;
  cleanedUp = true;

  const keys = await redis.keys(`user:sockets:*:${INSTANCE_ID}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  console.log(`Presence cleanup [${INSTANCE_ID}]: cleared ${keys.length} socket sets`);
}

export function registerPresenceHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  setOnline(userId, socket.id);

  socket.on('presence:heartbeat', () => {
    redis.setex(`user:online:${userId}`, PRESENCE_TTL, '1');
  });

  socket.on('disconnect', async () => {
    await redis.srem(`user:sockets:${userId}:${INSTANCE_ID}`, socket.id);

    const allKeys = await redis.keys(`user:sockets:${userId}:*`);
    let totalSockets = 0;
    for (const key of allKeys) {
      totalSockets += await redis.scard(key);
    }

    if (totalSockets === 0) {
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
  await redis.sadd(`user:sockets:${userId}:${INSTANCE_ID}`, socketId);
  await redis.setex(`user:online:${userId}`, PRESENCE_TTL, '1');
  await prisma.user.update({
    where: { id: userId },
    data: { isOnline: true },
  });
}
