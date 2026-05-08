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
import { prisma } from './config/database.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/user/user.routes.js';
import { chatRoutes } from './modules/chat/chat.routes.js';
import { messageRoutes } from './modules/message/message.routes.js';
import { groupRoutes } from './modules/group/group.routes.js';
import { uploadRoutes } from './modules/upload/upload.routes.js';
import { friendRoutes } from './modules/friend/friend.routes.js';
import { statsRoutes } from './modules/stats/stats.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { storageTestRoutes } from './modules/admin/storage-test.routes.js';
import { referralsRoutes } from './modules/referrals/referrals.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';
import { yookassaWebhookRoutes } from './modules/wallet/yookassa.webhook.js';
import { stakingRoutes } from './modules/staking/staking.routes.js';
import { lotteryRoutes } from './modules/lottery/lottery.routes.js';
import { revenueRoutes } from './modules/revenue/revenue.routes.js';
import { treasuryRoutes } from './modules/treasury/treasury.routes.js';
import { superchatRoutes } from './modules/superchat/superchat.routes.js';
import { publicProfileRoutes } from './modules/publicProfile/publicProfile.routes.js';
import { boostRoutes } from './modules/boost/boost.routes.js';
import { customizationRoutes } from './modules/customization/customization.routes.js';
import { nodesRoutes } from './modules/nodes/nodes.routes.js';
import { turnRoutes } from './modules/turn/turn.routes.js';
import { nftRoutes } from './modules/nft/nft.routes.js';
import { keysRoutes } from './modules/keys/keys.routes.js';
import { priceRoutes } from './modules/price/price.routes.js';
import { p2pRoutes } from './modules/p2p/p2p.routes.js';
import { merchantRoutes } from './modules/merchant/merchant.routes.js';
import { channelRoutes } from './modules/channel/channel.routes.js';
import { moderationRoutes } from './modules/moderation/moderation.routes.js';
import { moderatorRoutes } from './modules/moderation/moderator.routes.js';
import { botManagementRoutes } from './modules/bot/bot.routes.js';
import { botApiRoutes } from './modules/bot/botApi.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { pushRoutes } from './modules/push/push.routes.js';

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
    limits: { fileSize: 50 * 1024 * 1024 }, // Max 50MB, per-user limits in routes
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check (used by Cloudflare / load balancer)
  app.get('/health', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      return {
        status: 'ok',
        instance: process.env.INSTANCE_ID || 'default',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch (e) {
      reply.status(503);
      return { status: 'error', message: (e as Error).message };
    }
  });

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
  await app.register(storageTestRoutes, { prefix: '/api/v1/admin' });
  await app.register(referralsRoutes, { prefix: '/api/v1/referrals' });
  await app.register(walletRoutes, { prefix: '/api/v1/wallet' });
  await app.register(yookassaWebhookRoutes, { prefix: '/api/v1/yookassa' });
  await app.register(stakingRoutes, { prefix: '/api/v1/staking' });
  await app.register(lotteryRoutes, { prefix: '/api/v1/lottery' });
  await app.register(revenueRoutes, { prefix: '/api/v1/revenue' });
  await app.register(treasuryRoutes, { prefix: '/api/v1/treasury' });
  await app.register(superchatRoutes, { prefix: '/api/v1/superchat' });
  // Public — no auth, used by share-link landing pages.
  await app.register(publicProfileRoutes, { prefix: '/api/v1/u' });
  await app.register(boostRoutes, { prefix: '/api/v1/boost' });
  await app.register(customizationRoutes, { prefix: '/api/v1/customization' });
  await app.register(nodesRoutes, { prefix: '/api/v1/nodes' });
  await app.register(turnRoutes, { prefix: '/api/v1/turn' });
  await app.register(nftRoutes, { prefix: '/api/v1/nft' });
  await app.register(keysRoutes, { prefix: '/api/v1/keys' });
  await app.register(priceRoutes, { prefix: '/api/v1/price' });
  await app.register(p2pRoutes, { prefix: '/api/v1/p2p' });
  await app.register(merchantRoutes, { prefix: '/api/v1/merchant' });
  await app.register(channelRoutes, { prefix: '/api/v1/channels' });
  await app.register(moderationRoutes, { prefix: '/api/v1/moderation' });
  await app.register(moderatorRoutes, { prefix: '/api/v1/moderator' });
  await app.register(botManagementRoutes, { prefix: '/api/v1/bots' });
  await app.register(botApiRoutes, { prefix: '/api/v1/bot' });
  await app.register(searchRoutes, { prefix: '/api/v1/search' });
  await app.register(pushRoutes, { prefix: '/api/v1/push' });

  return app;
}
