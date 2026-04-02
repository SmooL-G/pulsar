import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { verifySignature, generateNonce } from '../../utils/solana.js';

export async function userRoutes(app: FastifyInstance) {
  // All user routes require authentication
  app.addHook('preHandler', authMiddleware);

  // Search users
  app.get('/', async (request) => {
    const { q, search, limit = 20, offset = 0 } = request.query as {
      q?: string;
      search?: string;
      limit?: number;
      offset?: number;
    };
    const query = q || search;

    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { username: { contains: query, mode: 'insensitive' } },
              { displayName: { contains: query, mode: 'insensitive' } },
              { walletAddress: { contains: query, mode: 'insensitive' } },
            ],
            status: 'ACTIVE',
          }
        : { status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        walletAddress: true,
        isOnline: true,
        lastSeenAt: true,
        verificationLevel: true,
        profileBadge: true,
      },
      take: Math.min(Number(limit), 50),
      skip: Number(offset),
    });

    return { users };
  });

  // Get user profile
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id, status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        walletAddress: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
        verificationLevel: true,
        socialLinks: true,
        profileBadge: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return user;
  });

  // Update own profile
  app.patch('/me', async (request) => {
    const { displayName, bio, avatarUrl, socialLinks } = request.body as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      socialLinks?: Record<string, string>;
    };

    // Sanitize socialLinks — only allow known keys
    let cleanLinks: Record<string, string> | undefined;
    if (socialLinks && typeof socialLinks === 'object') {
      const allowed = ['telegram', 'twitter', 'youtube', 'instagram', 'github', 'website'];
      cleanLinks = {};
      for (const key of allowed) {
        if (socialLinks[key] && typeof socialLinks[key] === 'string') {
          cleanLinks[key] = socialLinks[key].trim().slice(0, 200);
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: request.user!.userId },
      data: {
        displayName,
        bio,
        avatarUrl,
        ...(cleanLinks !== undefined ? { socialLinks: cleanLinks } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        walletAddress: true,
        verificationLevel: true,
        socialLinks: true,
        profileBadge: true,
      },
    });

    return user;
  });

  // ─── Привязка внешнего кошелька ────────────────────────

  // Шаг 1: запросить nonce для подписи
  app.post('/me/wallet/nonce', async (request) => {
    const { walletAddress } = request.body as { walletAddress: string };
    if (!walletAddress || typeof walletAddress !== 'string') {
      return { error: 'INVALID_INPUT', message: 'walletAddress is required' };
    }

    // Проверяем что кошелёк не занят другим пользователем
    const existing = await prisma.user.findUnique({ where: { walletAddress } });
    if (existing && existing.id !== request.user!.userId) {
      return { error: 'WALLET_TAKEN', message: 'This wallet is already linked to another account' };
    }

    const nonce = generateNonce();
    await redis.setex(`link-nonce:${walletAddress}`, 300, nonce);
    return { nonce };
  });

  // Шаг 2: верификация подписи и привязка
  app.post('/me/wallet/link', async (request, reply) => {
    const { walletAddress, signature } = request.body as {
      walletAddress: string;
      signature: string;
    };

    if (!walletAddress || !signature) {
      return reply.status(400).send({ error: 'INVALID_INPUT', message: 'walletAddress and signature are required' });
    }

    // Получаем nonce
    const nonce = await redis.get(`link-nonce:${walletAddress}`);
    if (!nonce) {
      return reply.status(400).send({ error: 'NONCE_EXPIRED', message: 'Nonce expired, request a new one' });
    }

    // Верификация подписи
    const isValid = verifySignature(nonce, signature, walletAddress);
    if (!isValid) {
      return reply.status(401).send({ error: 'INVALID_SIGNATURE', message: 'Signature verification failed' });
    }

    await redis.del(`link-nonce:${walletAddress}`);

    // Проверяем что кошелёк не занят
    const existing = await prisma.user.findUnique({ where: { walletAddress } });
    if (existing && existing.id !== request.user!.userId) {
      return reply.status(409).send({ error: 'WALLET_TAKEN', message: 'This wallet is already linked to another account' });
    }

    // Обновляем пользователя — привязываем внешний кошелёк
    const user = await prisma.user.update({
      where: { id: request.user!.userId },
      data: {
        walletAddress,
        walletType: 'EXTERNAL',
        encryptedPrivateKey: null, // Убираем кастодиальный ключ
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        walletAddress: true,
        walletType: true,
        verificationLevel: true,
        profileBadge: true,
      },
    });

    return user;
  });
}
