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

  // Clear this instance's socket sets
  const keys = await redis.keys(`user:sockets:*:${INSTANCE_ID}`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  // Reset ALL users to offline on server start (they'll reconnect via socket)
  await prisma.user.updateMany({
    where: { isOnline: true, isBot: false },
    data: { isOnline: false, lastSeenAt: new Date() },
  });

  // Clear all online keys
  const onlineKeys = await redis.keys('user:online:*');
  if (onlineKeys.length > 0) {
    await redis.del(...onlineKeys);
  }

  console.log(`Presence cleanup [${INSTANCE_ID}]: cleared ${keys.length} socket sets, reset all users offline`);

  // Periodic stale presence cleanup (every 2 minutes)
  setInterval(async () => {
    try {
      const onlineUsers = await prisma.user.findMany({
        where: { isOnline: true, isBot: false },
        select: { id: true },
      });
      for (const user of onlineUsers) {
        const isReallyOnline = await redis.get(`user:online:${user.id}`);
        if (!isReallyOnline) {
          await prisma.user.update({
            where: { id: user.id },
            data: { isOnline: false, lastSeenAt: new Date() },
          });
        }
      }
    } catch {}
  }, 120_000);
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
