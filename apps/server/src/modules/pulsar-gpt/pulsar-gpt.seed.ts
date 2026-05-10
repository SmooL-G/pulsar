import { prisma } from '../../config/database.js';

export let PULSAR_GPT_BOT_USER_ID: string | null = null;

const BOT_BIO = '🤖 Мульти-модельный AI-ассистент. Чат, изображения, оживление фото, видео из текста.';
const BOT_START = '🤖 Привет!\n\nДобро пожаловать в Pulsar GPT — твой AI-помощник.\n\n✨ Что я умею:\n• 💬 Диалог с AI (DeepSeek · GPT-4o · Claude · Gemini)\n• 🎨 Генерация изображений (Flux · Imagen · GPT Image-2)\n• 🎬 Оживление фотографий (Grok · Bytedance Seedance)\n• 🎥 Видео из текста (Veo · Grok · Seedance)\n• 🎤 Озвучка текста (скоро)\n\nНапиши /menu чтобы открыть кнопки.';

/**
 * One-shot seed for the system bot account that represents Pulsar GPT
 * in the chat list. Idempotent — safe to run on every boot. The
 * actual chat UI lives on the dedicated /pulsar-gpt page; this row
 * exists so users see "Pulsar GPT" in their contacts and can find
 * the bot like any other chat partner.
 */
export async function seedPulsarGptBot(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { username: 'pulsargpt' },
    select: { id: true },
  });

  if (existing) {
    PULSAR_GPT_BOT_USER_ID = existing.id;
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
        displayName: 'Pulsar GPT',
        bio: BOT_BIO,
      },
    }).catch(() => {});
    await prisma.bot.updateMany({
      where: { userId: existing.id, isSystemBot: true },
      data: { startMessage: BOT_START },
    }).catch(() => {});
    return existing.id;
  }

  const botUser = await prisma.user.create({
    data: {
      username: 'pulsargpt',
      displayName: 'Pulsar GPT',
      bio: BOT_BIO,
      walletAddress: 'system_pulsargpt_v1',
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
      startMessage: BOT_START,
      commands: [
        { command: 'start', description: 'Открыть Pulsar GPT' },
        { command: 'chat', description: 'Чат с ИИ' },
        { command: 'image', description: 'Создать картинку' },
        { command: 'video', description: 'Видео из текста' },
      ],
    },
  });

  PULSAR_GPT_BOT_USER_ID = botUser.id;
  console.log(`[PulsarGPT] Seeded system bot: @pulsargpt (${botUser.id})`);
  return botUser.id;
}

/**
 * Idempotent one-shot: migrate existing user-settings rows whose model
 * picks point at known-broken defaults to the current safe defaults.
 * Safe to re-run on every boot — only touches rows still on the broken
 * value, so user-overridden choices aren't trampled.
 */
export async function migratePulsarGptDefaults() {
  const result = await prisma.pulsarGptUserSettings.updateMany({
    where: { imageModel: 'flux-2/flex-text-to-image' },
    data: { imageModel: 'google/imagen4-fast' },
  });
  if (result.count > 0) {
    console.log(`[PulsarGPT] Migrated ${result.count} user(s) from flux-2 → imagen4-fast`);
  }
}
