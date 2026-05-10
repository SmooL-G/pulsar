import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { authMiddleware, adminMiddleware } from '../../middleware/auth.js';

const ROLE_HIERARCHY: Record<string, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

function hasRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 99);
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // All admin routes require at least MODERATOR
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !hasRole(request.user.role, 'MODERATOR')) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Admin access required' });
    }
  });

  // ─── SYSTEM BOTS (SUPER_ADMIN) ─────────────────────────
  // Mint or rotate the API token for a system bot (e.g. @pulsargpt).
  // The standard /api/v1/bots/:id/token/regenerate endpoint excludes
  // system bots, so this is the only path to obtain a callable token
  // for the bots seeded by the platform itself.
  app.post<{ Body: { username: string } }>(
    '/system-bots/regenerate-token',
    async (request, reply) => {
      if (!hasRole(request.user!.role, 'SUPER_ADMIN')) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'SUPER_ADMIN required' });
      }
      const username = (request.body?.username || '').trim();
      if (!username) return reply.status(400).send({ error: 'username required' });
      const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
      if (!user) return reply.status(404).send({ error: 'BOT_USER_NOT_FOUND' });
      const bot = await prisma.bot.findFirst({
        where: { userId: user.id, isSystemBot: true },
        select: { id: true },
      });
      if (!bot) return reply.status(404).send({ error: 'SYSTEM_BOT_NOT_FOUND' });

      const prefix = bot.id.replace(/-/g, '').slice(0, 8);
      const secret = randomBytes(24).toString('base64url');
      const tokenRaw = `${prefix}:${secret}`;
      const tokenHash = await bcrypt.hash(tokenRaw, 10);

      await prisma.bot.update({
        where: { id: bot.id },
        data: { tokenHash, tokenPlain: tokenRaw },
      });
      await redis.del(`bot:auth:${bot.id}`);
      return { token: tokenRaw, botId: bot.id, username };
    },
  );

  // DELETE /system-bots/:username — purge a system bot completely.
  // Removes the Bot row (kills its API token), wipes pulsar_gpt_*
  // tables for that bot user, and soft-deletes the user (renames
  // to free the username, sets status=DELETED). Messages remain
  // for chat history integrity.
  app.delete<{ Params: { username: string } }>(
    '/system-bots/:username',
    async (request, reply) => {
      if (!hasRole(request.user!.role, 'SUPER_ADMIN')) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'SUPER_ADMIN required' });
      }
      const { username } = request.params;
      const user = await prisma.user.findUnique({
        where: { username },
        select: { id: true, isBot: true, role: true },
      });
      if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
      if (!user.isBot) return reply.status(400).send({ error: 'NOT_A_BOT' });
      if (user.role === 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot delete admin-bot' });
      }

      const bots = await prisma.bot.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const botIds = bots.map((b) => b.id);

      // Optional: pulsar_gpt tables (may not exist on all installs)
      const pulsarGptCleanup = Promise.allSettled([
        prisma.pulsarGptRequest.deleteMany({ where: { userId: user.id } }),
        prisma.pulsarGptUserSettings.deleteMany({ where: { userId: user.id } }),
      ]);

      await prisma.bot.deleteMany({ where: { userId: user.id } });
      await pulsarGptCleanup;

      // Soft-delete user: free the username so it can be reused;
      // mark status DELETED. Don't hard-delete because messages
      // reference user as sender and we don't want orphans in chats.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'DELETED',
          username: `deleted_${user.id.slice(0, 8)}`,
          isOnline: false,
        },
      });

      // Bust per-bot auth caches
      for (const id of botIds) await redis.del(`bot:auth:${id}`);
      await redis.del('admin:dashboard');

      return { ok: true, deletedUserId: user.id, deletedBotIds: botIds };
    },
  );

  // ─── DASHBOARD ──────────────────────────────────────────
  app.get('/dashboard', async (request) => {
    const cached = await redis.get('admin:dashboard');
    if (cached) return JSON.parse(cached);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [userCount, onlineCount, newUsersWeek, messagesToday, totalMessages, totalGroups] =
      await Promise.all([
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.user.count({ where: { isOnline: true } }),
        prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.message.count(),
        prisma.chat.count({ where: { type: 'GROUP' } }),
      ]);

    // Messages per day (last 7 days)
    const messagesPerDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = await prisma.message.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });
      messagesPerDay.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      });
    }

    // New users per day (last 7 days)
    const usersPerDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const count = await prisma.user.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });
      usersPerDay.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      });
    }

    const result = {
      userCount,
      onlineCount,
      newUsersWeek,
      messagesToday,
      totalMessages,
      totalGroups,
      messagesPerDay,
      usersPerDay,
    };

    await redis.set('admin:dashboard', JSON.stringify(result), 'EX', 30);
    return result;
  });

  // ─── USERS LIST ─────────────────────────────────────────
  app.get('/users', async (request: FastifyRequest<{
    Querystring: { q?: string; limit?: string; offset?: string; role?: string; status?: string };
  }>) => {
    if (!hasRole(request.user!.role, 'ADMIN')) {
      return { error: 'FORBIDDEN', message: 'Admin role required' };
    }

    const { q, limit = '20', offset = '0', role, status } = request.query;
    const take = Math.min(parseInt(limit) || 20, 100);
    const skip = parseInt(offset) || 0;

    const where: any = {};
    if (q) {
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { walletAddress: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          walletAddress: true,
          walletType: true,
          avatarUrl: true,
          role: true,
          status: true,
          verificationLevel: true,
          isOnline: true,
          createdAt: true,
          lastSeenAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total, limit: take, offset: skip };
  });

  // ─── CHANGE ROLE ────────────────────────────────────────
  app.patch('/users/:id/role', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { role: string };
  }>, reply) => {
    const { id } = request.params;
    const { role } = request.body as { role: string };
    const actorRole = request.user!.role;

    if (id === request.user!.userId) {
      return reply.status(400).send({ error: 'INVALID', message: 'Cannot change own role' });
    }

    // SUPER_ADMIN can set any role, ADMIN can only set MODERATOR
    if (actorRole === 'ADMIN' && role !== 'MODERATOR' && role !== 'USER') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Admin can only assign MODERATOR or USER' });
    }
    if (!hasRole(actorRole, 'ADMIN')) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Admin role required' });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Cannot change SUPER_ADMIN role
    if (target.role === 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot change SUPER_ADMIN role' });
    }
    // ADMIN cannot change another ADMIN
    if (actorRole === 'ADMIN' && target.role === 'ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot change another ADMIN' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: role as any },
      select: { id: true, role: true },
    });

    // Invalidate session cache
    await redis.del(`admin:dashboard`);

    return updated;
  });

  // ─── CHANGE VERIFICATION ────────────────────────────────
  app.patch('/users/:id/verification', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { level: number };
  }>, reply) => {
    const { id } = request.params;
    const { level } = request.body as { level: number };
    const actorRole = request.user!.role;

    if (!hasRole(actorRole, 'ADMIN')) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Admin role required' });
    }

    // ADMIN can set 0-2, SUPER_ADMIN can set 0-3
    const maxLevel = actorRole === 'SUPER_ADMIN' ? 3 : 2;
    if (level < 0 || level > maxLevel) {
      return reply.status(400).send({ error: 'INVALID', message: `Level must be 0-${maxLevel}` });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { verificationLevel: level },
      select: { id: true, verificationLevel: true },
    });

    return updated;
  });

  // ─── BAN / UNBAN ────────────────────────────────────────
  app.patch('/users/:id/ban', async (request: FastifyRequest<{
    Params: { id: string };
    Body: { banned: boolean };
  }>, reply) => {
    const { id } = request.params;
    const { banned } = request.body as { banned: boolean };
    const actorRole = request.user!.role;

    if (!hasRole(actorRole, 'ADMIN')) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Admin role required' });
    }

    if (id === request.user!.userId) {
      return reply.status(400).send({ error: 'INVALID', message: 'Cannot ban yourself' });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Cannot ban SUPER_ADMIN or equal/higher role
    if (ROLE_HIERARCHY[target.role] >= ROLE_HIERARCHY[actorRole]) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot ban user with equal or higher role' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: banned ? 'BANNED' : 'ACTIVE' },
      select: { id: true, status: true },
    });

    await redis.del('admin:dashboard');
    return updated;
  });

  // ─── DELETE USER ────────────────────────────────────────
  app.delete('/users/:id', async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply) => {
    const actorRole = request.user!.role;
    const { id } = request.params;

    if (actorRole !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'SUPER_ADMIN required' });
    }

    if (id === request.user!.userId) {
      return reply.status(400).send({ error: 'INVALID', message: 'Cannot delete yourself' });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (target.role === 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Cannot delete another SUPER_ADMIN' });
    }

    await prisma.user.update({
      where: { id },
      data: { status: 'DELETED' },
    });

    await redis.del('admin:dashboard');
    return { success: true };
  });

  // ─── PLS BANK BALANCE (SUPER_ADMIN) ────────────────────
  app.get('/bank', async (request, reply) => {
    if (request.user!.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'SUPER_ADMIN required' });
    }

    const totalSupply = BigInt('22000000000000000');

    // Sum all user wallets
    const result = await prisma.plsWallet.aggregate({
      _sum: { balance: true },
    });
    const distributed = result._sum.balance ?? BigInt(0);
    const bankBalance = totalSupply - distributed;

    // Recent reward transactions
    const recentRewards = await prisma.plsTransaction.findMany({
      where: { type: 'REWARD' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        wallet: {
          select: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    return {
      totalSupply: totalSupply.toString(),
      distributed: distributed.toString(),
      bankBalance: bankBalance.toString(),
      recentRewards: recentRewards.map((tx) => ({
        id: tx.id,
        amount: tx.amount.toString(),
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
        user: tx.wallet.user,
      })),
    };
  });

  // ─── REWARD USER (ADMIN+) ────────────────────────────
  app.post('/reward', async (request: FastifyRequest<{
    Body: { userId: string; amount: number; description?: string };
  }>, reply) => {
    if (!hasRole(request.user!.role, 'ADMIN')) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Admin role required' });
    }

    const { userId, amount, description } = request.body as { userId: string; amount: number; description?: string };

    if (!userId || !amount || amount <= 0 || amount > 1000000) {
      return reply.status(400).send({ error: 'INVALID', message: 'Amount must be 1-1,000,000 PLS' });
    }

    // Check bank balance
    const totalSupply = BigInt('22000000000000000');
    const agg = await prisma.plsWallet.aggregate({ _sum: { balance: true } });
    const distributed = agg._sum.balance ?? BigInt(0);
    const bankBalance = totalSupply - distributed;
    const rewardAmount = BigInt(amount);

    if (rewardAmount > bankBalance) {
      return reply.status(400).send({ error: 'INSUFFICIENT', message: 'Not enough PLS in bank' });
    }

    // Find or create target wallet
    let wallet = await prisma.plsWallet.findUnique({ where: { userId } });
    if (!wallet) {
      wallet = await prisma.plsWallet.create({ data: { userId } });
    }

    // Credit
    const [updatedWallet, transaction] = await prisma.$transaction([
      prisma.plsWallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: rewardAmount } },
      }),
      prisma.plsTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'REWARD',
          amount: rewardAmount,
          description: description || `Reward from ${request.user!.role}`,
          status: 'COMPLETED',
        },
      }),
    ]);

    return {
      success: true,
      balance: updatedWallet.balance.toString(),
      transaction: {
        id: transaction.id,
        amount: transaction.amount.toString(),
        description: transaction.description,
      },
    };
  });

  // ─── SYSTEM INFO (SUPER_ADMIN only) ────────────────────
  app.get('/system', async (request, reply) => {
    if (request.user!.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'SUPER_ADMIN required' });
    }

    const redisInfo = await redis.info('memory');
    const memoryMatch = redisInfo.match(/used_memory_human:(\S+)/);

    return {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage(),
      redisMemory: memoryMatch?.[1] || 'unknown',
      timestamp: Date.now(),
    };
  });
}
