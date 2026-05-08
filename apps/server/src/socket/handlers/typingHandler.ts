import type { Server, Socket } from 'socket.io';
import { redis } from '../../config/redis.js';

const TYPING_TTL = 5; // seconds
// Global "typing right now" set across all chats — powers the public
// pulse widget on the dashboard / login page. Score = expiration ms,
// stale entries are pruned lazily on read.
const GLOBAL_KEY = 'typing:now';

export function registerTypingHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on('typing:start', async (data) => {
    await redis.hset(`chat:typing:${data.chatId}`, userId, Date.now().toString());
    await redis.expire(`chat:typing:${data.chatId}`, TYPING_TTL);
    // Mirror to the global pulse set with TTL embedded as score.
    await redis.zadd(GLOBAL_KEY, Date.now() + TYPING_TTL * 1000, userId);

    socket.to(`chat:${data.chatId}`).emit('typing:update', {
      chatId: data.chatId,
      users: [{ id: userId, username: '' }], // Username resolved client-side
    });
  });

  socket.on('typing:stop', async (data) => {
    await redis.hdel(`chat:typing:${data.chatId}`, userId);
    await redis.zrem(GLOBAL_KEY, userId);

    socket.to(`chat:${data.chatId}`).emit('typing:update', {
      chatId: data.chatId,
      users: [],
    });
  });
}

/** Live count of users currently typing across the whole platform.
 *  Lazily prunes stale entries (anyone whose typing window has passed)
 *  before counting. Public — used by the dashboard / login pulse. */
export async function getTypingNow(): Promise<number> {
  const now = Date.now();
  await redis.zremrangebyscore(GLOBAL_KEY, 0, now);
  return redis.zcard(GLOBAL_KEY);
}
