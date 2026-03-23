import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@pulsar/shared';
import { env } from '../config/env.js';
import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { registerChatHandlers } from './handlers/chatHandler.js';
import { registerMessageHandlers } from './handlers/messageHandler.js';
import { registerTypingHandlers } from './handlers/typingHandler.js';
import { registerPresenceHandlers } from './handlers/presenceHandler.js';

export type AppSocket = Server<ClientToServerEvents, ServerToClientEvents>;

let io: AppSocket;

export function getIO(): AppSocket {
  return io;
}

export function initSocketServer(httpServer: HttpServer) {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const userId = (socket.data as { userId: string }).userId;
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    // Join personal room for targeted events
    socket.join(`user:${userId}`);

    // Register event handlers
    registerChatHandlers(io, socket);
    registerMessageHandlers(io, socket);
    registerTypingHandlers(io, socket);
    registerPresenceHandlers(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${userId} (reason: ${reason})`);
    });
  });

  return io;
}
