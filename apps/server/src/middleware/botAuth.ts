import type { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';

export interface BotAuthPayload {
  userId: string;
  walletAddress: string;
  role: string;
  isBot: boolean;
  botId: string;
  ownerId: string;
}

export async function botAuthMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bot ')) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing Bot token' });
  }

  const rawToken = authHeader.slice(4).trim();
  const colonIdx = rawToken.indexOf(':');
  if (colonIdx === -1) {
    return reply.status(401).send({ error: 'INVALID_TOKEN', message: 'Invalid token format' });
  }

  const botId = rawToken.slice(0, colonIdx);
  const cacheKey = `bot:auth:${botId}`;

  // Try Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    request.user = JSON.parse(cached);
    // Update lastSeenAt async
    prisma.bot.update({ where: { id: botId }, data: { lastSeenAt: new Date() } }).catch(() => {});
    return;
  }

  // Fetch from DB
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: {
      user: { select: { id: true, walletAddress: true, status: true } },
    },
  });

  if (!bot || !bot.isActive || bot.user.status !== 'ACTIVE') {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Bot not found or inactive' });
  }

  // System bot uses 'system' tokenHash — not for external auth
  if (bot.isSystemBot) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'System bots cannot authenticate via token' });
  }

  const valid = await bcrypt.compare(rawToken, bot.tokenHash);
  if (!valid) {
    return reply.status(401).send({ error: 'INVALID_TOKEN', message: 'Invalid token' });
  }

  const payload: BotAuthPayload = {
    userId: bot.userId,
    walletAddress: bot.user.walletAddress,
    role: 'USER',
    isBot: true,
    botId: bot.id,
    ownerId: bot.ownerId,
  };

  request.user = payload as any;

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(payload));

  // Update lastSeenAt async
  prisma.bot.update({ where: { id: botId }, data: { lastSeenAt: new Date() } }).catch(() => {});
}
