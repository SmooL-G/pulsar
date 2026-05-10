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
  // Image: flux-2 had input_urls quirks, then imagen-ultra returned
  // 500s — both KIE-side. DALL-E 3 via relay is sync, fast and proven
  // in the ИИдинорожек ref impl. Migrate any user still on the older
  // KIE-image defaults onto DALL-E.
  const r1 = await prisma.pulsarGptUserSettings.updateMany({
    where: { imageModel: { in: ['flux-2/flex-text-to-image', 'google/imagen4-fast'] } },
    data: { imageModel: 'dall-e-3' },
  });
  if (r1.count > 0) console.log(`[PulsarGPT] Migrated ${r1.count} user(s) imageModel → dall-e-3`);

  // Animate: ported to working Kling 2.5 Turbo model ID per ИИдинорожек
  // ref impl. Old IDs ("kling/image-to-video", "bytedance/seedance-2-fast")
  // either don't exist or use different APIs.
  const r2 = await prisma.pulsarGptUserSettings.updateMany({
    where: { animateModel: { in: ['bytedance/seedance-2-fast', 'kling/image-to-video'] } },
    data: { animateModel: 'kling/v2-5-turbo-image-to-video-pro' },
  });
  if (r2.count > 0) console.log(`[PulsarGPT] Migrated ${r2.count} user(s) animateModel → kling/v2-5-turbo`);

  // Video: Veo 3 Fast lives on a separate /api/v1/veo/generate endpoint
  // and is the proven text-to-video winner in the ref impl.
  const r3 = await prisma.pulsarGptUserSettings.updateMany({
    where: { videoModel: { in: ['kling/text-to-video', 'bytedance/seedance-2-fast'] } },
    data: { videoModel: 'veo3_fast' },
  });
  if (r3.count > 0) console.log(`[PulsarGPT] Migrated ${r3.count} user(s) videoModel → veo3_fast`);
}
