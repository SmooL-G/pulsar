import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/auth.js';
import { redis } from '../../config/redis.js';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

function generateBotUsername(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_pls';
}

async function ensureUniqueUsername(base: string): Promise<string | null> {
  const candidates = [
    base,
    base.replace(/_pls$/, '_bot'),
    ...Array.from({ length: 9 }, (_, i) => `${base}${i + 2}`),
  ];
  for (const candidate of candidates) {
    const exists = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  return null;
}

function serializeBot(bot: any) {
  return {
    id: bot.id,
    userId: bot.userId,
    ownerId: bot.ownerId,
    username: bot.user?.username,
    displayName: bot.user?.displayName,
    avatarUrl: bot.user?.avatarUrl,
    bio: bot.user?.bio,
    webhookUrl: bot.webhookUrl,
    commands: bot.commands || [],
    isActive: bot.isActive,
    token: bot.tokenPlain,
    lastSeenAt: bot.lastSeenAt?.toISOString() || null,
    createdAt: bot.createdAt.toISOString(),
    updatedAt: bot.updatedAt.toISOString(),
  };
}

export async function botManagementRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // POST / — создать бота
  app.post<{ Body: { name: string } }>('/', async (request, reply) => {
    const ownerId = request.user!.userId;
    const { name } = request.body;

    if (!name || name.trim().length < 2 || name.trim().length > 64) {
      return reply.status(400).send({ error: 'INVALID_NAME' });
    }

    const baseUsername = generateBotUsername(name.trim());
    const username = await ensureUniqueUsername(baseUsername);
    if (!username) {
      return reply.status(409).send({ error: 'USERNAME_UNAVAILABLE' });
    }

    const botUser = await prisma.user.create({
      data: {
        username,
        displayName: name.trim(),
        walletAddress: `bot_${randomBytes(16).toString('hex')}`,
        walletType: 'CUSTODIAL',
        isBot: true,
        status: 'ACTIVE',
      },
    });

    const prefix = botUser.id.replace(/-/g, '').slice(0, 8);
    const secret = randomBytes(24).toString('base64url');
    const tokenRaw = `${prefix}:${secret}`;
    const tokenHash = await bcrypt.hash(tokenRaw, 10);

    const bot = await prisma.bot.create({
      data: {
        userId: botUser.id,
        ownerId,
        tokenHash,
        tokenPlain: tokenRaw,
      },
      include: {
        user: { select: { username: true, displayName: true, avatarUrl: true, bio: true } },
      },
    });

    return reply.status(201).send({
      bot: serializeBot(bot),
      token: tokenRaw,
    });
  });

  // GET / — список своих ботов
  app.get('/', async (request) => {
    const ownerId = request.user!.userId;
    const bots = await prisma.bot.findMany({
      where: { ownerId, isSystemBot: false },
      include: { user: { select: { username: true, displayName: true, avatarUrl: true, bio: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { bots: bots.map(serializeBot) };
  });

  // GET /:botId — детали бота
  app.get<{ Params: { botId: string } }>('/:botId', async (request, reply) => {
    const ownerId = request.user!.userId;
    const bot = await prisma.bot.findFirst({
      where: { id: request.params.botId, ownerId, isSystemBot: false },
      include: { user: { select: { username: true, displayName: true, avatarUrl: true, bio: true } } },
    });
    if (!bot) return reply.status(404).send({ error: 'BOT_NOT_FOUND' });
    return { bot: serializeBot(bot) };
  });

  // PATCH /:botId — обновить имя / вебхук / команды
  app.patch<{ Params: { botId: string }; Body: { name?: string; bio?: string; avatarUrl?: string; webhookUrl?: string; commands?: any[] } }>(
    '/:botId',
    async (request, reply) => {
      const ownerId = request.user!.userId;
      const { name, bio, avatarUrl, webhookUrl, commands } = request.body;

      const bot = await prisma.bot.findFirst({
        where: { id: request.params.botId, ownerId, isSystemBot: false },
        select: { id: true, userId: true },
      });
      if (!bot) return reply.status(404).send({ error: 'BOT_NOT_FOUND' });

      const updates: any = {};
      if (webhookUrl !== undefined) updates.webhookUrl = webhookUrl || null;
      if (commands !== undefined) updates.commands = commands;

      const userUpdates: any = {};
      if (name) userUpdates.displayName = name.trim();
      if (bio !== undefined) userUpdates.bio = bio || null;
      if (avatarUrl !== undefined) userUpdates.avatarUrl = avatarUrl || null;

      await Promise.all([
        Object.keys(updates).length ? prisma.bot.update({ where: { id: bot.id }, data: updates }) : Promise.resolve(),
        Object.keys(userUpdates).length ? prisma.user.update({ where: { id: bot.userId }, data: userUpdates }) : Promise.resolve(),
      ]);

      await redis.del(`bot:auth:${bot.id}`);
      return { success: true };
    }
  );

  // POST /:botId/token/regenerate
  app.post<{ Params: { botId: string } }>('/:botId/token/regenerate', async (request, reply) => {
    const ownerId = request.user!.userId;
    const bot = await prisma.bot.findFirst({
      where: { id: request.params.botId, ownerId, isSystemBot: false },
      select: { id: true },
    });
    if (!bot) return reply.status(404).send({ error: 'BOT_NOT_FOUND' });

    const prefix = bot.id.replace(/-/g, '').slice(0, 8);
    const secret = randomBytes(24).toString('base64url');
    const tokenRaw = `${prefix}:${secret}`;
    const tokenHash = await bcrypt.hash(tokenRaw, 10);

    await prisma.bot.update({ where: { id: bot.id }, data: { tokenHash, tokenPlain: tokenRaw } });
    await redis.del(`bot:auth:${bot.id}`);

    return { token: tokenRaw };
  });

  // DELETE /:botId
  app.delete<{ Params: { botId: string } }>('/:botId', async (request, reply) => {
    const ownerId = request.user!.userId;
    const bot = await prisma.bot.findFirst({
      where: { id: request.params.botId, ownerId, isSystemBot: false },
      select: { id: true, userId: true },
    });
    if (!bot) return reply.status(404).send({ error: 'BOT_NOT_FOUND' });

    await prisma.user.delete({ where: { id: bot.userId } }); // cascade
    await redis.del(`bot:auth:${bot.id}`);

    return { success: true };
  });

  // GET /chat/:chatId/commands — команды всех ботов в чате (для автодополнения)
  app.get<{ Params: { chatId: string } }>('/chat/:chatId/commands', async (request, reply) => {
    const userId = request.user!.userId;

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: request.params.chatId, userId } },
      select: { id: true, leftAt: true },
    });
    if (!membership || membership.leftAt) {
      return reply.status(403).send({ error: 'NOT_MEMBER' });
    }

    const botMembers = await prisma.chatMember.findMany({
      where: { chatId: request.params.chatId, leftAt: null, user: { isBot: true } },
      include: {
        user: { include: { botProfile: { select: { commands: true } } } },
      },
    });

    const result: { botUsername: string; command: string; description: string }[] = [];
    for (const m of botMembers) {
      const commands = ((m.user as any).botProfile?.commands as any[]) || [];
      for (const c of commands) {
        result.push({
          botUsername: (m.user as any).username,
          command: c.command,
          description: c.description || '',
        });
      }
    }

    return { commands: result };
  });
}
