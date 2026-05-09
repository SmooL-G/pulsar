import { prisma } from '../../config/database.js';
import { getIO } from '../../socket/index.js';
import { PULSAR_GPT_BOT_USER_ID } from './pulsar-gpt.seed.js';

/**
 * Pulsar GPT chat handler. The actual interactive UI lives at
 * /pulsar-gpt — this handler just gives users a friendly response when
 * they message the bot in DM (so the bot doesn't look broken). All
 * inbound messages get the same "open the page" reply with a deep link.
 */

async function sendReply(chatId: string, text: string) {
  if (!PULSAR_GPT_BOT_USER_ID) return;
  const msg = await prisma.message.create({
    data: {
      chatId,
      senderId: PULSAR_GPT_BOT_USER_ID,
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
      metadata: msg.metadata as any,
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

const REPLY_RU =
  '🤖 Pulsar GPT — мой полный интерфейс на отдельной странице:\n\n' +
  '👉 https://pulsar-chat.fun/pulsar-gpt\n\n' +
  'Там всё есть:\n' +
  '💬 Чат с ИИ (DeepSeek, GPT, Claude, Gemini)\n' +
  '🎨 Генерация картинок (Flux, Imagen, GPT Image)\n' +
  '🎬 Оживление фото (image → video)\n' +
  '🎥 Видео из текста (Veo, Seedance, Grok)\n' +
  '⚙️ Настройки моделей и баланса\n\n' +
  'Открой — попробуй прямо сейчас!';

const REPLY_EN =
  '🤖 Pulsar GPT — full interface lives on a dedicated page:\n\n' +
  '👉 https://pulsar-chat.fun/pulsar-gpt\n\n' +
  'There you can:\n' +
  '💬 Chat with AI (DeepSeek, GPT, Claude, Gemini)\n' +
  '🎨 Generate images (Flux, Imagen, GPT Image)\n' +
  '🎬 Animate photos (image → video)\n' +
  '🎥 Text-to-video (Veo, Seedance, Grok)\n' +
  '⚙️ Settings and balance\n\n' +
  'Open it — try right now!';

export async function handlePulsarGptMessage(userId: string, chatId: string, _text: string) {
  // Detect locale from user record (default ru since most of our base is RU).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  // No proper locale field on User — fall back to RU. UI changes locale per
  // browser, server here just uses RU as default since 80%+ of users are RU.
  void user;
  await sendReply(chatId, REPLY_RU);
}
