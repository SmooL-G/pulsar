import { prisma } from '../../config/database.js';

export let PULSAR_BOT_USER_ID: string | null = null;

export async function seedPulsarBot(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { username: 'pulsarbot' },
    select: { id: true },
  });

  if (existing) {
    PULSAR_BOT_USER_ID = existing.id;
    // Гарантируем что бот всегда онлайн + актуальный bio
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
        displayName: 'PulsarBot',
        bio: 'Official Pulsar system bot. Send /help for commands.',
      },
    }).catch(() => {});
    return existing.id;
  }

  const botUser = await prisma.user.create({
    data: {
      username: 'pulsarbot',
      displayName: 'PulsarBot',
      bio: 'Official Pulsar system bot. Send /help for commands.',
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
    },
  });

  PULSAR_BOT_USER_ID = botUser.id;
  console.log(`[PulsarBot] Seeded system bot: @pulsarbot (${botUser.id})`);
  return botUser.id;
}
