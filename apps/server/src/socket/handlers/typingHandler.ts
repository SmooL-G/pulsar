import type { Server, Socket } from 'socket.io';
import { redis } from '../../config/redis.js';

const TYPING_TTL = 5; // seconds

export function registerTypingHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on('typing:start', async (data) => {
    await redis.hset(`chat:typing:${data.chatId}`, userId, Date.now().toString());
    await redis.expire(`chat:typing:${data.chatId}`, TYPING_TTL);

    // Get all currently typing users
    const typingUsers = await redis.hkeys(`chat:typing:${data.chatId}`);
    const activeTypers = typingUsers.filter((id) => id !== userId);

    socket.to(`chat:${data.chatId}`).emit('typing:update', {
      chatId: data.chatId,
      users: [{ id: userId, username: '' }], // Username resolved client-side
    });
  });

  socket.on('typing:stop', async (data) => {
    await redis.hdel(`chat:typing:${data.chatId}`, userId);

    socket.to(`chat:${data.chatId}`).emit('typing:update', {
      chatId: data.chatId,
      users: [],
    });
  });
}
