import { prisma } from '../../config/database.js';

export let PULSAR_BOT_USER_ID: string | null = null;

const PULSAR_BOT_BIO = 'Официальный бот Pulsar. Создавайте и управляйте своими ботами через команды.';
const PULSAR_BOT_START = '👋 Привет! Я PulsarBot — ваш помощник по созданию и управлению ботами Pulsar.\n\nНажмите /start чтобы увидеть доступные команды.';
const PULSAR_BOT_COMMANDS = [
  { command: 'start', description: 'Показать меню с кнопками' },
  { command: 'newbot', description: 'Создать нового бота' },
  { command: 'mybots', description: 'Список ваших ботов' },
  { command: 'token', description: 'Получить/перевыпустить токен' },
  { command: 'setwebhook', description: 'Установить webhook URL' },
  { command: 'setcommands', description: 'Настроить команды бота' },
  { command: 'info', description: 'Информация о боте' },
  { command: 'deletebot', description: 'Удалить бота' },
  { command: 'help', description: 'Список всех команд' },
];

export async function seedPulsarBot(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { username: 'pulsarbot' },
    select: { id: true },
  });

  if (existing) {
    PULSAR_BOT_USER_ID = existing.id;
    // Гарантируем что бот всегда онлайн + актуальный bio + startMessage
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
        displayName: 'PulsarBot',
        bio: PULSAR_BOT_BIO,
      },
    }).catch(() => {});
    // Обновляем startMessage и commands в Bot
    await prisma.bot.updateMany({
      where: { userId: existing.id, isSystemBot: true },
      data: {
        startMessage: PULSAR_BOT_START,
        commands: PULSAR_BOT_COMMANDS,
      },
    }).catch(() => {});
    return existing.id;
  }

  const botUser = await prisma.user.create({
    data: {
      username: 'pulsarbot',
      displayName: 'PulsarBot',
      bio: PULSAR_BOT_BIO,
      walletAddress: 'system_pulsarbot_v1',
      walletType: 'CUSTODIAL',
      isBot: true,
      status: 'ACTIVE',
      isOnline: true,
      lastSeenAt: new Date(),
    },
  });

  await prisma.bot.create({
    data: {
      userId: botUser.id,
      ownerId: botUser.id,
      tokenHash: 'system',
      isSystemBot: true,
      isActive: true,
      startMessage: PULSAR_BOT_START,
      commands: PULSAR_BOT_COMMANDS,
    },
  });

  PULSAR_BOT_USER_ID = botUser.id;
  console.log(`[PulsarBot] Seeded system bot: @pulsarbot (${botUser.id})`);
  return botUser.id;
}
