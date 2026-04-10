/**
 * PulsarBot — системный бот-управляющий (аналог Telegram BotFather).
 * Обрабатывает команды пользователей в DM-чате с @pulsarbot.
 */
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { getIO } from '../../socket/index.js';
import { PULSAR_BOT_USER_ID } from './pulsarBot.seed.js';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const SESSION_TTL = 600; // 10 минут

type SessionState =
  | 'idle'
  | 'awaiting_name'
  | 'awaiting_setwebhook_bot'
  | 'awaiting_setwebhook_url'
  | 'awaiting_token_bot'
  | 'awaiting_delete_bot'
  | 'awaiting_setcommands_bot'
  | 'awaiting_setcommands_input';

interface Session {
  state: SessionState;
  data?: Record<string, string>;
}

async function getSession(userId: string): Promise<Session> {
  const raw = await redis.get(`bot:pulsarbot:session:${userId}`);
  if (!raw) return { state: 'idle' };
  try { return JSON.parse(raw); } catch { return { state: 'idle' }; }
}

async function setSession(userId: string, session: Session) {
  await redis.setex(`bot:pulsarbot:session:${userId}`, SESSION_TTL, JSON.stringify(session));
}

async function clearSession(userId: string) {
  await redis.del(`bot:pulsarbot:session:${userId}`);
}

async function sendReply(chatId: string, text: string) {
  if (!PULSAR_BOT_USER_ID) return;
  const msg = await prisma.message.create({
    data: {
      chatId,
      senderId: PULSAR_BOT_USER_ID,
      content: text,
      type: 'TEXT',
    },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, isBot: true },
      },
    },
  });

  const io = getIO();
  if (io) {
    io.to(`chat:${chatId}`).emit('message:new', {
      id: msg.id,
      chatId: msg.chatId,
      senderId: msg.senderId,
      content: msg.content,
      type: msg.type,
      replyToId: null,
      isEdited: false,
      isDeleted: false,
      metadata: null,
      signature: null,
      signerWallet: null,
      encryptedContent: null,
      encryptionType: null,
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.updatedAt.toISOString(),
      sender: msg.sender,
      status: 'sent',
      attachments: [],
    } as any);
  }
}

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

async function getUserBots(ownerId: string) {
  return prisma.bot.findMany({
    where: { ownerId, isSystemBot: false },
    include: { user: { select: { username: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function handlePulsarBotMessage(userId: string, chatId: string, text: string) {
  const trimmed = text.trim();
  const session = await getSession(userId);

  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    await handleCommand(userId, chatId, cmd, args, session);
    return;
  }

  // Обработка состояний диалога
  if (session.state !== 'idle') {
    await handleStateInput(userId, chatId, trimmed, session);
  } else {
    await sendReply(chatId, 'Напишите /start чтобы узнать доступные команды.');
  }
}

async function handleCommand(userId: string, chatId: string, cmd: string, args: string[], session: Session) {
  switch (cmd) {
    case 'start':
      await clearSession(userId);
      await sendReply(chatId,
        '👋 Привет! Я PulsarBot — здесь вы можете создавать ботов для интеграции с Pulsar.\n\n' +
        'Доступные команды:\n' +
        '/newbot — Создать нового бота\n' +
        '/mybots — Список ваших ботов\n' +
        '/token @username — Получить/перевыпустить токен\n' +
        '/setwebhook @username <url> — Установить вебхук\n' +
        '/setcommands @username — Установить команды бота\n' +
        '/deletebot @username — Удалить бота\n' +
        '/info @username — Информация о боте'
      );
      break;

    case 'newbot':
      await setSession(userId, { state: 'awaiting_name' });
      await sendReply(chatId, '🤖 Создание нового бота.\n\nВведите название вашего бота (например: "Crypto Helper"):');
      break;

    case 'mybots': {
      const bots = await getUserBots(userId);
      if (bots.length === 0) {
        await sendReply(chatId, 'У вас ещё нет ботов. Напишите /newbot чтобы создать первого.');
      } else {
        const lines: string[] = [];
        for (let i = 0; i < bots.length; i++) {
          const b = bots[i];
          const userCount = await prisma.chatMember.count({ where: { userId: b.userId, leftAt: null } });
          lines.push(`${i + 1}. ${b.user.displayName} — @${b.user.username} · 👥 ${userCount}${b.webhookUrl ? ' 🟢' : ' ⚫'}`);
        }
        await sendReply(chatId, `📋 Ваши боты:\n\n${lines.join('\n')}\n\nДля управления используйте /token, /setwebhook, /info`);
      }
      break;
    }

    case 'token': {
      const username = args[0]?.replace(/^@/, '');
      if (!username) {
        await setSession(userId, { state: 'awaiting_token_bot' });
        await sendReply(chatId, 'Введите username бота (без @):');
        break;
      }
      await handleTokenCommand(userId, chatId, username);
      break;
    }

    case 'setwebhook': {
      const username = args[0]?.replace(/^@/, '');
      const url = args[1];
      if (!username || !url) {
        await setSession(userId, { state: 'awaiting_setwebhook_bot' });
        await sendReply(chatId, 'Введите username бота (без @):');
        break;
      }
      await handleSetWebhook(userId, chatId, username, url);
      break;
    }

    case 'deletebot': {
      const username = args[0]?.replace(/^@/, '');
      if (!username) {
        await setSession(userId, { state: 'awaiting_delete_bot' });
        await sendReply(chatId, 'Введите username бота (без @):');
        break;
      }
      await handleDeleteBot(userId, chatId, username);
      break;
    }

    case 'info': {
      const username = args[0]?.replace(/^@/, '');
      if (!username) {
        await sendReply(chatId, 'Использование: /info @username');
        break;
      }
      await handleInfo(userId, chatId, username);
      break;
    }

    case 'setcommands': {
      const username = args[0]?.replace(/^@/, '');
      if (!username) {
        await setSession(userId, { state: 'awaiting_setcommands_bot' });
        await sendReply(chatId, 'Введите username бота (без @):');
        break;
      }
      await setSession(userId, { state: 'awaiting_setcommands_input', data: { username } });
      await sendReply(chatId,
        `Введите команды для @${username} в формате:\n/command - Описание\n/help - Помощь\n\nПо одной на строку:`
      );
      break;
    }

    default:
      await sendReply(chatId, 'Неизвестная команда. Напишите /start для списка команд.');
  }
}

async function handleStateInput(userId: string, chatId: string, text: string, session: Session) {
  switch (session.state) {
    case 'awaiting_name': {
      if (text.length < 2 || text.length > 64) {
        await sendReply(chatId, '❌ Название должно быть от 2 до 64 символов. Попробуйте ещё раз:');
        return;
      }
      const baseUsername = generateBotUsername(text);
      const username = await ensureUniqueUsername(baseUsername);
      if (!username) {
        await clearSession(userId);
        await sendReply(chatId, '❌ Не удалось подобрать уникальный username. Попробуйте другое название.');
        return;
      }

      // Создаём бота
      const secret = randomBytes(24).toString('base64url');
      const prefix = randomBytes(4).toString('hex'); // 8 hex chars
      const tokenRaw = `${prefix}:${secret}`;
      const tokenHash = await bcrypt.hash(tokenRaw, 10);

      const botUser = await prisma.user.create({
        data: {
          username,
          displayName: text,
          walletAddress: `bot_${randomBytes(16).toString('hex')}`,
          walletType: 'CUSTODIAL',
          isBot: true,
          status: 'ACTIVE',
        },
      });

      await prisma.bot.create({
        data: {
          userId: botUser.id,
          ownerId: userId,
          tokenHash,
        },
      });

      await clearSession(userId);
      await sendReply(chatId,
        `✅ Бот создан!\n\n` +
        `Имя: ${text}\n` +
        `Username: @${username}\n\n` +
        `🔑 Токен API (сохраните, больше не покажем):\n${tokenRaw}\n\n` +
        `⚠️ Храните токен в тайне! Для обновления токена используйте /token @${username}`
      );
      break;
    }

    case 'awaiting_token_bot':
      await clearSession(userId);
      await handleTokenCommand(userId, chatId, text.replace(/^@/, ''));
      break;

    case 'awaiting_setwebhook_bot':
      await setSession(userId, { state: 'awaiting_setwebhook_url', data: { username: text.replace(/^@/, '') } });
      await sendReply(chatId, 'Введите URL вебхука (или "clear" для удаления):');
      break;

    case 'awaiting_setwebhook_url': {
      const username = session.data?.username || '';
      await clearSession(userId);
      await handleSetWebhook(userId, chatId, username, text);
      break;
    }

    case 'awaiting_delete_bot':
      await clearSession(userId);
      await handleDeleteBot(userId, chatId, text.replace(/^@/, ''));
      break;

    case 'awaiting_setcommands_bot':
      await setSession(userId, { state: 'awaiting_setcommands_input', data: { username: text.replace(/^@/, '') } });
      await sendReply(chatId, `Введите команды в формате:\n/command - Описание\n\nПо одной на строку:`);
      break;

    case 'awaiting_setcommands_input': {
      const username = session.data?.username || '';
      await clearSession(userId);
      const bot = await findUserBot(userId, username);
      if (!bot) {
        await sendReply(chatId, `❌ Бот @${username} не найден или не ваш.`);
        return;
      }
      const commands = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('/'))
        .map(line => {
          const [cmdPart, ...rest] = line.slice(1).split(/\s*[-–]\s*/);
          return { command: cmdPart.trim(), description: rest.join(' ').trim() || '' };
        })
        .filter(c => c.command.length > 0);

      await prisma.bot.update({ where: { id: bot.id }, data: { commands } });
      // Invalidate cache
      await redis.del(`bot:auth:${bot.id}`);
      await sendReply(chatId,
        `✅ Команды для @${username} обновлены:\n` +
        commands.map(c => `/${c.command} — ${c.description}`).join('\n')
      );
      break;
    }

    default:
      await clearSession(userId);
  }
}

async function findUserBot(ownerId: string, username: string) {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) return null;
  return prisma.bot.findFirst({
    where: { userId: user.id, ownerId, isSystemBot: false },
  });
}

async function handleTokenCommand(userId: string, chatId: string, username: string) {
  const bot = await findUserBot(userId, username);
  if (!bot) {
    await sendReply(chatId, `❌ Бот @${username} не найден или не принадлежит вам.`);
    return;
  }
  // Перевыпускаем токен
  const secret = randomBytes(24).toString('base64url');
  const prefix = bot.id.replace(/-/g, '').slice(0, 8);
  const tokenRaw = `${prefix}:${secret}`;
  const tokenHash = await bcrypt.hash(tokenRaw, 10);

  await prisma.bot.update({ where: { id: bot.id }, data: { tokenHash } });
  await redis.del(`bot:auth:${bot.id}`);

  await sendReply(chatId,
    `🔑 Новый токен для @${username}:\n${tokenRaw}\n\n⚠️ Старый токен больше не работает!`
  );
}

async function handleSetWebhook(userId: string, chatId: string, username: string, url: string) {
  const bot = await findUserBot(userId, username);
  if (!bot) {
    await sendReply(chatId, `❌ Бот @${username} не найден или не принадлежит вам.`);
    return;
  }

  const webhookUrl = url.toLowerCase() === 'clear' ? null : url;
  if (webhookUrl && !webhookUrl.startsWith('https://')) {
    await sendReply(chatId, '❌ Вебхук должен быть HTTPS-адресом.');
    return;
  }

  await prisma.bot.update({ where: { id: bot.id }, data: { webhookUrl } });
  await redis.del(`bot:auth:${bot.id}`);

  await sendReply(chatId,
    webhookUrl
      ? `✅ Вебхук для @${username} установлен:\n${webhookUrl}`
      : `✅ Вебхук для @${username} удалён.`
  );
}

async function handleDeleteBot(userId: string, chatId: string, username: string) {
  const bot = await findUserBot(userId, username);
  if (!bot) {
    await sendReply(chatId, `❌ Бот @${username} не найден или не принадлежит вам.`);
    return;
  }

  await prisma.user.delete({ where: { id: bot.userId } }); // cascade deletes Bot
  await redis.del(`bot:auth:${bot.id}`);

  await sendReply(chatId, `🗑️ Бот @${username} удалён.`);
}

async function handleInfo(userId: string, chatId: string, username: string) {
  const bot = await findUserBot(userId, username);
  if (!bot) {
    await sendReply(chatId, `❌ Бот @${username} не найден или не принадлежит вам.`);
    return;
  }

  // Считаем количество чатов/пользователей
  const chatCount = await prisma.chatMember.count({
    where: { userId: bot.userId, leftAt: null },
  });

  const commands = (bot.commands as any[]) || [];
  const cmdList = commands.length
    ? commands.map((c: any) => `/${c.command} — ${c.description}`).join('\n')
    : 'Команды не установлены';

  await sendReply(chatId,
    `ℹ️ Бот @${username}\n\n` +
    `👥 Пользователей: ${chatCount}\n` +
    `Вебхук: ${bot.webhookUrl || 'не установлен'}\n` +
    `Статус: ${bot.isActive ? '🟢 активен' : '🔴 отключён'}\n` +
    `Последняя активность: ${bot.lastSeenAt ? bot.lastSeenAt.toLocaleString('ru') : 'никогда'}\n\n` +
    `Команды:\n${cmdList}`
  );
}
