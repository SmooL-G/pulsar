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
        role: true,
        profileBadge: true,
        nickColor: true,
        avatarFrame: true,
        bubbleColor: true,
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
        role: true,
        socialLinks: true,
        profileBadge: true,
        nickColor: true,
        avatarFrame: true,
        bubbleColor: true,
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return user;
  });

  // Update own profile
  // Username change with cooldown + uniqueness. Allowed once every 30 days.
  // Reserved names (system/admin/etc.) are rejected. Old @username links
  // start pointing to the new owner immediately — that's fine since the
  // cooldown discourages handle-recycling for impersonation.
  const RESERVED_USERNAMES = new Set([
    'admin', 'administrator', 'root', 'system', 'pulsar', 'support', 'help',
    'official', 'api', 'bot', 'team', 'me', 'self', 'login', 'signup',
    'register', 'logout', 'auth', 'profile', 'settings', 'privacy', 'terms',
    'wallet', 'mining', 'docs', 'developers',
  ]);
  const USERNAME_RE = /^[A-Za-z0-9_-]{3,32}$/;
  const USERNAME_COOLDOWN_DAYS = 30;

  app.patch<{ Body: { username: string } }>('/me/username', async (request, reply) => {
    const userId = request.user!.userId;
    const desired = (request.body?.username || '').trim();
    if (!USERNAME_RE.test(desired)) {
      return reply.status(400).send({
        error: 'BAD_USERNAME',
        message: '3-32 chars, A-Z a-z 0-9 _ -',
      });
    }
    if (RESERVED_USERNAMES.has(desired.toLowerCase())) {
      return reply.status(400).send({ error: 'RESERVED', message: 'This username is reserved' });
    }

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, usernameChangedAt: true },
    });
    if (!me) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (me.username === desired) {
      return reply.status(400).send({ error: 'SAME', message: 'New username matches current' });
    }
    if (me.usernameChangedAt) {
      const elapsed = Date.now() - me.usernameChangedAt.getTime();
      const cooldownMs = USERNAME_COOLDOWN_DAYS * 24 * 3600 * 1000;
      if (elapsed < cooldownMs) {
        const daysLeft = Math.ceil((cooldownMs - elapsed) / (24 * 3600 * 1000));
        return reply.status(429).send({
          error: 'COOLDOWN',
          message: `Available again in ${daysLeft} days`,
          daysLeft,
        });
      }
    }

    const taken = await prisma.user.findFirst({
      where: { username: { equals: desired, mode: 'insensitive' }, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) {
      return reply.status(409).send({ error: 'TAKEN', message: 'Username already in use' });
    }

    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { username: desired, usernameChangedAt: new Date() },
        select: { id: true, username: true, usernameChangedAt: true },
      });
      return {
        username: updated.username,
        usernameChangedAt: updated.usernameChangedAt?.toISOString() ?? null,
      };
    } catch {
      return reply.status(409).send({ error: 'TAKEN' });
    }
  });

  app.patch('/me', async (request) => {
    const {
      displayName,
      bio,
      avatarUrl,
      socialLinks,
      nickColor: _nickColor,
      pushMuteFrom,
      pushMuteTo,
      pushMuteTimezone,
    } = request.body as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      socialLinks?: Record<string, string>;
      nickColor?: string;
      pushMuteFrom?: number | null;
      pushMuteTo?: number | null;
      pushMuteTimezone?: string | null;
    };
    // nickColor is set only via /wallet/purchase-nick-color, not here
    void _nickColor;

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

    // Quiet hours validation: nullable to disable, otherwise minutes 0-1439
    // and a non-empty IANA tz string. Anything else is rejected silently
    // (left unchanged) so a bad client never bricks the user.
    const validMinute = (v: unknown): v is number =>
      typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1439;
    const muteFromUpdate =
      pushMuteFrom === null ? null : validMinute(pushMuteFrom) ? pushMuteFrom : undefined;
    const muteToUpdate =
      pushMuteTo === null ? null : validMinute(pushMuteTo) ? pushMuteTo : undefined;
    const muteTzUpdate =
      pushMuteTimezone === null
        ? null
        : typeof pushMuteTimezone === 'string' && pushMuteTimezone.length > 0 && pushMuteTimezone.length <= 64
          ? pushMuteTimezone
          : undefined;

    const user = await prisma.user.update({
      where: { id: request.user!.userId },
      data: {
        displayName,
        bio,
        avatarUrl,
        ...(cleanLinks !== undefined ? { socialLinks: cleanLinks } : {}),
        ...(muteFromUpdate !== undefined ? { pushMuteFrom: muteFromUpdate } : {}),
        ...(muteToUpdate !== undefined ? { pushMuteTo: muteToUpdate } : {}),
        ...(muteTzUpdate !== undefined ? { pushMuteTimezone: muteTzUpdate } : {}),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        walletAddress: true,
        verificationLevel: true,
        role: true,
        socialLinks: true,
        profileBadge: true,
        nickColor: true,
        avatarFrame: true,
        bubbleColor: true,
        pushMuteFrom: true,
        pushMuteTo: true,
        pushMuteTimezone: true,
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
        role: true,
        profileBadge: true,
        nickColor: true,
        avatarFrame: true,
        bubbleColor: true,
      },
    });

    return user;
  });
}
