import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { redis } from './config/redis.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import { chatRoutes } from './modules/chat/chat.routes.js';
import { messageRoutes } from './modules/message/message.routes.js';
import { groupRoutes } from './modules/group/group.routes.js';
import { uploadRoutes } from './modules/upload/upload.routes.js';
import { friendRoutes } from './modules/friend/friend.routes.js';
import { statsRoutes } from './modules/stats/stats.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    },
  });

  // Plugins
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // API routes
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(userRoutes, { prefix: '/api/v1/users' });
  await app.register(chatRoutes, { prefix: '/api/v1/chats' });
  await app.register(messageRoutes, { prefix: '/api/v1/messages' });
  await app.register(groupRoutes, { prefix: '/api/v1/groups' });
  await app.register(uploadRoutes, { prefix: '/api/v1/upload' });
  await app.register(friendRoutes, { prefix: '/api/v1/friends' });
  await app.register(statsRoutes, { prefix: '/api/v1/stats' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });
  await app.register(walletRoutes, { prefix: '/api/v1/wallet' });

  return app;
}
