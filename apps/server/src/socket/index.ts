import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ClientToServerEvents, ServerToClientEvents } from '@pulsar/shared';
import { env } from '../config/env.js';
import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { registerChatHandlers } from './handlers/chatHandler.js';
import { registerMessageHandlers } from './handlers/messageHandler.js';
import { registerTypingHandlers } from './handlers/typingHandler.js';
import { registerPresenceHandlers, cleanupPresenceOnStart } from './handlers/presenceHandler.js';
import { registerWebrtcHandlers } from './handlers/webrtcHandler.js';
import { registerCallHandlers } from './handlers/callHandler.js';

export type AppSocket = Server<ClientToServerEvents, ServerToClientEvents>;

let io: AppSocket;

export function getIO(): AppSocket {
  return io;
}

export function initSocketServer(httpServer: HttpServer) {
  const pubClient = new Redis(env.REDIS_URL);
  const subClient = pubClient.duplicate();

  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    adapter: createAdapter(pubClient, subClient),
  });

  cleanupPresenceOnStart();

  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = (socket.data as { userId: string }).userId;
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    socket.join(`user:${userId}`);

    registerChatHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerWebrtcHandlers(io, socket);
    registerCallHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${userId} (reason: ${reason})`);
    });
  });

  return io;
}
