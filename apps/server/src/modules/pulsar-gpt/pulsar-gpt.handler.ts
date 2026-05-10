import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { getIO } from '../../socket/index.js';
import { PULSAR_GPT_BOT_USER_ID } from './pulsar-gpt.seed.js';
import { runChat, startTask, getUserSettings, updateUserSettings, PulsarGptError } from './pulsar-gpt.service.js';

/**
 * In-chat Pulsar GPT bot — full conversational UX in DM. Inline buttons
 * surface a 4-action menu (chat / image / video / animate); each action
 * sets a session state that consumes the user's next message and runs
 * the corresponding model.
 *
 * Result delivery: chat replies are sent inline immediately. Image /
 * video / animate are async — the worker (pulsar-gpt.worker.ts) posts
 * the result back into this chat once the upstream task completes.
 *
 * Sessions live in Redis with a 1h TTL so an idle conversation auto-
 * exits without leaking state.
 */

const SESSION_TTL = 3600;

type SessionState =
  | 'idle'
  | 'chat'                  // streaming dialog mode — every msg goes to LLM
  | 'awaiting_image_prompt'
  | 'awaiting_video_prompt'
  | 'awaiting_animate_image'
  | 'awaiting_animate_prompt';

interface Session {
  state: SessionState;
  /** Last 20 user/assistant pairs for chat-mode context. */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Pending uploaded image URL during animate flow. */
  animateImageUrl?: string;
}

async function getSession(userId: string): Promise<Session> {
  const raw = await redis.get(`bot:pulsargpt:session:${userId}`);
  if (!raw) return { state: 'idle' };
  try { return JSON.parse(raw); } catch { return { state: 'idle' }; }
}

async function setSession(userId: string, session: Session) {
  await redis.setex(`bot:pulsargpt:session:${userId}`, SESSION_TTL, JSON.stringify(session));
}

async function clearSession(userId: string) {
  await redis.del(`bot:pulsargpt:session:${userId}`);
}

interface InlineButton { text: string; callbackData: string }

async function sendBot(chatId: string, text: string, buttons?: InlineButton[][]) {
  if (!PULSAR_GPT_BOT_USER_ID) return;
  const msg = await prisma.message.create({
    data: {
      chatId,
      senderId: PULSAR_GPT_BOT_USER_ID,
      content: text,
      type: 'TEXT',
      // Cast through `any` because Prisma's NullableJsonNullValueInput
      // is too strict to accept our typed inline button shape directly.
      ...(buttons && { metadata: { buttons } as any }),
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true, isBot: true } },
    },
  });
  const io = getIO();
  if (io) {
    io.to(`chat:${chatId}`).emit('message:new', {
      id: msg.id, chatId: msg.chatId, senderId: msg.senderId, content: msg.content, type: msg.type,
      replyToId: null, isEdited: false, isDeleted: false, metadata: msg.metadata as any,
      signature: null, signerWallet: null, encryptedContent: null, encryptionType: null,
      createdAt: msg.createdAt.toISOString(), updatedAt: msg.updatedAt.toISOString(),
      sender: msg.sender, status: 'sent', attachments: [],
    } as any);
  }
}

const MENU_BUTTONS: InlineButton[][] = [
  [{ text: '💬 Диалог с AI', callbackData: 'gpt:chat' }],
  [{ text: '🎨 Создать изображение', callbackData: 'gpt:image' }],
  [
    { text: '🎬 Оживить фото', callbackData: 'gpt:animate' },
    { text: '🎥 Видео из текста', callbackData: 'gpt:video' },
  ],
  [{ text: '🎤 Озвучить текст', callbackData: 'gpt:voice' }],
  [
    { text: '👤 Мой профиль', callbackData: 'gpt:profile' },
    { text: '💎 Купить PLS', callbackData: 'gpt:topup' },
  ],
  [{ text: '⚙ Сменить модель', callbackData: 'gpt:settings' }],
];

interface ModelOption {
  id: string;
  name: string;
  cost: string;
  desc: string;
  recommended?: boolean;
}

/** Catalog of user-pickable models, grouped by category. ⭐ marks the
 *  recommended default that gives the best balance of quality, cost
 *  and moderation strictness for each task. */
const MODEL_CATALOG: Record<'image' | 'animate' | 'video' | 'chat', ModelOption[]> = {
  image: [
    { id: 'google/imagen4-fast',           name: 'Imagen 4 Fast',  cost: '12 кр',  desc: 'Быстро, мягкая модерация, фотореализм', recommended: true },
    { id: 'google/imagen4',                name: 'Imagen 4',       cost: '25 кр',  desc: 'Высокое качество от Google' },
    { id: 'google/imagen4-ultra',          name: 'Imagen 4 Ultra', cost: '40 кр',  desc: 'Максимум деталей, медленно' },
    { id: 'flux-2/flex-text-to-image',     name: 'Flux 2 Flex',    cost: '10 кр',  desc: 'Дёшево, художественный стиль' },
    { id: 'flux-2/pro-text-to-image',      name: 'Flux 2 Pro',     cost: '15 кр',  desc: 'Точнее следует промпту' },
  ],
  animate: [
    { id: 'bytedance/seedance-2-fast',     name: 'Seedance 2 Fast', cost: '200 кр', desc: 'Быстро, базовое качество', recommended: true },
    { id: 'bytedance/seedance-2',          name: 'Seedance 2',      cost: '350 кр', desc: 'Лучшее качество анимации' },
    { id: 'bytedance/seedance-1-5-pro',    name: 'Seedance 1.5',    cost: '300 кр', desc: 'Стабильная старая версия' },
    { id: 'kling/image-to-video',          name: 'Kling I2V',       cost: '250 кр', desc: 'Другой стиль движения' },
  ],
  video: [
    { id: 'kling/text-to-video',           name: 'Kling T2V',       cost: '280 кр', desc: 'Хорошо для динамики', recommended: true },
    { id: 'bytedance/seedance-2-fast',     name: 'Seedance 2 Fast', cost: '200 кр', desc: 'Быстро' },
    { id: 'bytedance/seedance-2',          name: 'Seedance 2',      cost: '350 кр', desc: 'Топ-качество' },
  ],
  chat: [
    { id: 'deepseek-chat',                 name: 'DeepSeek',         cost: '~бесплатно', desc: 'Отличное качество, очень дёшево', recommended: true },
    { id: 'gpt-4o',                        name: 'GPT-4o',           cost: '$$',         desc: 'Флагман OpenAI' },
    { id: 'claude-sonnet-4-5',             name: 'Claude Sonnet 4.5', cost: '$$',        desc: 'Флагман Anthropic' },
    { id: 'gemini-2.0-flash',              name: 'Gemini 2.0 Flash', cost: '~дёшево',    desc: 'Флагман Google' },
  ],
};

const CATEGORY_LABELS: Record<string, string> = {
  image: 'картинок',
  animate: 'анимации',
  video: 'видео',
  chat: 'чата',
};

async function showMenu(userId: string, chatId: string) {
  // Personalized greeting + capability list + live balance.
  // Mirrors the convention popular Telegram AI bots use: friendly opener,
  // bullet list of capabilities (with concrete model names so it feels
  // real), wallet status, then big buttons.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, username: true, role: true },
  });
  const wallet = await prisma.plsWallet.findUnique({
    where: { userId },
    select: { balance: true },
  });
  const name = user?.displayName || user?.username || 'друг';
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const balance = wallet?.balance ?? 0n;

  const balanceLine = isAdmin
    ? '👑 Admin — все модели бесплатно'
    : balance > 0n
      ? `💰 Твой баланс: ${balance.toLocaleString()} PLS`
      : '💰 Баланс пуст — пополни через P2P-биржу или подписку';

  const text =
    `🤖 Привет, ${name}!\n` +
    `\nДобро пожаловать в Pulsar GPT — твой AI-помощник.\n` +
    `\n✨ Что я умею:\n` +
    `• 💬 Диалог с AI (DeepSeek · GPT-4o · Claude · Gemini)\n` +
    `• 🎨 Генерация изображений (Flux · Imagen · GPT Image-2)\n` +
    `• 🎬 Оживление фотографий (Grok · Bytedance Seedance)\n` +
    `• 🎥 Создание видео из текста (Veo · Grok · Seedance)\n` +
    `• 🎤 Озвучка текста (скоро)\n` +
    `\n${balanceLine}\n` +
    `\nВыбери действие 👇`;

  await sendBot(chatId, text, MENU_BUTTONS);
}

/** Detect first message attachment that's an image. */
function firstImageAttachment(attachments: any[] | undefined): string | null {
  if (!attachments?.length) return null;
  for (const a of attachments) {
    const mime = a.mimeType || a.mime_type || '';
    if (mime.startsWith('image/') && a.url) return a.url;
  }
  return null;
}

/**
 * Main message dispatch. Called by the socket handler whenever a user
 * sends a message in a chat that includes the @pulsargpt bot.
 *
 * `text` may be empty for attachment-only messages (used in the
 * animate flow for raw photo upload).
 */
export async function handlePulsarGptMessage(
  userId: string,
  chatId: string,
  text: string,
  attachments?: any[],
) {
  const trimmed = (text || '').trim();
  const lower = trimmed.toLowerCase();

  // Universal: /menu / /start always returns to the main menu.
  if (lower === '/menu' || lower === '/start' || lower === 'меню' || lower === 'menu') {
    await clearSession(userId);
    await showMenu(userId, chatId);
    return;
  }

  // Inline button callbacks come through as the literal callbackData
  // string (frontend posts it as if user typed it). Route accordingly.
  if (trimmed.startsWith('gpt:')) {
    return handleCallback(userId, chatId, trimmed);
  }

  const session = await getSession(userId);

  switch (session.state) {
    case 'chat':
      return handleChatTurn(userId, chatId, trimmed, session);
    case 'awaiting_image_prompt':
      return handleImagePrompt(userId, chatId, trimmed);
    case 'awaiting_video_prompt':
      return handleVideoPrompt(userId, chatId, trimmed);
    case 'awaiting_animate_image': {
      const imageUrl = firstImageAttachment(attachments);
      if (!imageUrl) {
        await sendBot(chatId, '📎 Пришли фото (картинку прикрепи к сообщению). Или /menu чтобы выйти.');
        return;
      }
      await setSession(userId, { state: 'awaiting_animate_prompt', animateImageUrl: imageUrl });
      await sendBot(chatId, '✓ Картинка получена.\n\nТеперь опиши какое движение добавить (или просто пришли «.» — будет авто-движение).\nИли /menu чтобы выйти.');
      return;
    }
    case 'awaiting_animate_prompt':
      return handleAnimatePrompt(userId, chatId, trimmed, session);
    case 'idle':
    default:
      await showMenu(userId, chatId);
      return;
  }
}

/** Top-level settings panel showing current picks and category buttons. */
async function showSettings(userId: string, chatId: string) {
  const s = await getUserSettings(userId);
  const text =
    `⚙ Настройки моделей\n\n` +
    `Текущие выборы:\n` +
    `• 🎨 Картинки: ${s.imageModel}\n` +
    `• 🎬 Анимация: ${s.animateModel}\n` +
    `• 🎥 Видео: ${s.videoModel}\n` +
    `• 💬 Чат: ${s.chatModel}\n\n` +
    `Что хочешь сменить?`;
  await sendBot(chatId, text, [
    [{ text: '🎨 Картинки', callbackData: 'gpt:set:image' }],
    [
      { text: '🎬 Анимация', callbackData: 'gpt:set:animate' },
      { text: '🎥 Видео', callbackData: 'gpt:set:video' },
    ],
    [{ text: '💬 Чат', callbackData: 'gpt:set:chat' }],
    [{ text: '« Назад в меню', callbackData: 'gpt:menu' }],
  ]);
}

/** Shows the model list for a category — current pick marked ✅,
 *  recommended marked ⭐. Buttons let the user one-click switch. */
async function showModelPicker(
  userId: string,
  chatId: string,
  category: 'image' | 'animate' | 'video' | 'chat',
) {
  const settings = await getUserSettings(userId);
  const currentMap: Record<typeof category, string> = {
    image: settings.imageModel,
    animate: settings.animateModel,
    video: settings.videoModel,
    chat: settings.chatModel,
  };
  const current = currentMap[category];
  const options = MODEL_CATALOG[category];

  const lines = [`Выбери модель для ${CATEGORY_LABELS[category]}:`, ''];
  const buttons: InlineButton[][] = [];
  for (const m of options) {
    const mark = m.id === current ? '✅ ' : '';
    const rec = m.recommended ? ' ⭐' : '';
    lines.push(`${mark}${m.name}${rec} — ${m.cost}`);
    lines.push(`   ${m.desc}`);
    lines.push('');
    buttons.push([{
      text: `${mark}${m.name} (${m.cost})`,
      callbackData: `gpt:pick:${category}:${m.id}`,
    }]);
  }
  buttons.push([{ text: '« К настройкам', callbackData: 'gpt:settings' }]);
  await sendBot(chatId, lines.join('\n'), buttons);
}

/** Persist a model pick and re-render the picker so the user sees the
 *  ✅ move to their new choice. */
async function pickModel(
  userId: string,
  chatId: string,
  category: string,
  modelId: string,
) {
  const patch: Parameters<typeof updateUserSettings>[1] = {};
  if (category === 'image') patch.imageModel = modelId;
  else if (category === 'animate') patch.animateModel = modelId;
  else if (category === 'video') patch.videoModel = modelId;
  else if (category === 'chat') patch.chatModel = modelId;
  else { await sendBot(chatId, '⚠ Неизвестная категория'); return; }
  await updateUserSettings(userId, patch);
  await sendBot(chatId, `✅ Сохранено: ${modelId}\n\nИспользуется со следующего запроса.`);
  await showModelPicker(userId, chatId, category as any);
}

async function handleCallback(userId: string, chatId: string, data: string) {
  const action = data.slice(4); // strip "gpt:"

  // gpt:set:<category> → open picker for that category
  if (action.startsWith('set:')) {
    const cat = action.slice(4);
    if (cat === 'image' || cat === 'animate' || cat === 'video' || cat === 'chat') {
      return showModelPicker(userId, chatId, cat);
    }
    return showSettings(userId, chatId);
  }

  // gpt:pick:<category>:<modelId> — modelId may contain '/' so we
  // split only on the first colon after the category.
  if (action.startsWith('pick:')) {
    const rest = action.slice(5);
    const colonIdx = rest.indexOf(':');
    if (colonIdx < 0) return showSettings(userId, chatId);
    const cat = rest.slice(0, colonIdx);
    const modelId = rest.slice(colonIdx + 1);
    return pickModel(userId, chatId, cat, modelId);
  }

  switch (action) {
    case 'menu':
      return showMenu(userId, chatId);
    case 'chat':
      await setSession(userId, { state: 'chat', history: [] });
      await sendBot(
        chatId,
        '💬 Чат с ИИ\n\nПросто пиши что угодно — я буду отвечать.\nКоманды:\n/menu — вернуться в меню\n/clear — очистить контекст',
      );
      return;
    case 'image':
      await setSession(userId, { state: 'awaiting_image_prompt' });
      await sendBot(chatId, '🎨 Опиши картинку (можно по-русски):\n\nПример: «кот в шляпе на луне, акварель»');
      return;
    case 'video':
      await setSession(userId, { state: 'awaiting_video_prompt' });
      await sendBot(chatId, '🎥 Опиши видео:\n\nПример: «дрон летит над горами на закате, 5 секунд»');
      return;
    case 'animate':
      await setSession(userId, { state: 'awaiting_animate_image' });
      await sendBot(chatId, '🎬 Прикрепи фото которое надо оживить.');
      return;
    case 'voice':
      await sendBot(
        chatId,
        '🎤 Озвучка текста — в разработке. Скоро добавим TTS-модели.\n\n/menu — вернуться',
      );
      return;
    case 'profile': {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, username: true, role: true, verificationLevel: true, merchantTier: true },
      });
      const wallet = await prisma.plsWallet.findUnique({
        where: { userId },
        select: { balance: true, lockedAmount: true },
      });
      const stats = await prisma.pulsarGptRequest.groupBy({
        by: ['type'],
        where: { userId },
        _count: { _all: true },
      });
      const isAdmin = user?.role === 'SUPER_ADMIN';
      const spendable = (wallet?.balance ?? 0n) - (wallet?.lockedAmount ?? 0n);
      const counts = stats.reduce<Record<string, number>>((acc, s) => {
        acc[s.type] = s._count._all;
        return acc;
      }, {});
      const text =
        `👤 ${user?.displayName || user?.username || 'юзер'}\n` +
        `\n📊 Уровень верификации: L${user?.verificationLevel ?? 0}\n` +
        (user?.merchantTier && user.merchantTier !== 'NONE' ? `🏆 Merchant: ${user.merchantTier}\n` : '') +
        `\n💰 Баланс: ${(wallet?.balance ?? 0n).toLocaleString()} PLS` +
        (spendable !== (wallet?.balance ?? 0n) ? ` (доступно ${spendable.toLocaleString()})\n` : '\n') +
        (isAdmin ? '👑 Admin — все модели бесплатно\n' : '') +
        `\n📈 Использовано:\n` +
        `• 💬 Диалогов: ${counts.CHAT ?? 0}\n` +
        `• 🎨 Картинок: ${counts.IMAGE ?? 0}\n` +
        `• 🎬 Анимаций: ${counts.ANIMATE ?? 0}\n` +
        `• 🎥 Видео: ${counts.VIDEO ?? 0}\n` +
        `\n⚙ Настройки моделей и история — на странице:\n👉 https://pulsar-chat.fun/pulsar-gpt`;
      await sendBot(chatId, text);
      return;
    }
    case 'topup':
      await sendBot(
        chatId,
        '💎 Купить PLS\n\n' +
        '1️⃣ P2P-биржа: купи у других пользователей за СБП / USDT\n' +
        '👉 https://pulsar-chat.fun/p2p\n\n' +
        '2️⃣ Кошелёк: пополнить с карты через YooKassa\n' +
        '👉 https://pulsar-chat.fun (открой кошелёк → «Пополнить»)\n\n' +
        '3️⃣ Майнинг: установи десктоп-приложение и зарабатывай PLS пока работает\n' +
        '👉 https://pulsar-chat.fun/download',
      );
      return;
    case 'settings':
      return showSettings(userId, chatId);
    default:
      await showMenu(userId, chatId);
  }
}

async function handleChatTurn(userId: string, chatId: string, text: string, session: Session) {
  if (text.toLowerCase() === '/clear') {
    await setSession(userId, { state: 'chat', history: [] });
    await sendBot(chatId, '✓ Контекст очищен. Пиши дальше.');
    return;
  }
  if (!text) {
    await sendBot(chatId, 'Напиши сообщение или /menu чтобы выйти.');
    return;
  }
  const history = session.history ?? [];
  const newHistory = [...history, { role: 'user' as const, content: text }];
  try {
    const settings = await getUserSettings(userId);
    const reply = await runChat({
      userId,
      model: settings.chatModel,
      messages: newHistory,
      maxTokens: 1024,
    });
    const updatedHistory = [...newHistory, { role: 'assistant' as const, content: reply.text }].slice(-40); // last 20 pairs
    await setSession(userId, { state: 'chat', history: updatedHistory });
    await sendBot(chatId, reply.text);
  } catch (e: any) {
    if (e instanceof PulsarGptError) {
      await sendBot(chatId, `⚠ ${e.message}\n\n/menu — вернуться`);
    } else {
      console.error('[pulsar-gpt-handler] chat error:', e);
      await sendBot(chatId, '⚠ Сбой связи с моделью. Попробуй ещё раз через минуту.');
    }
  }
}

async function handleImagePrompt(userId: string, chatId: string, prompt: string) {
  if (prompt.length < 2) {
    await sendBot(chatId, 'Описание слишком короткое. Опиши что нарисовать.');
    return;
  }
  await runAsyncTask(userId, chatId, 'IMAGE', prompt);
}

async function handleVideoPrompt(userId: string, chatId: string, prompt: string) {
  if (prompt.length < 2) {
    await sendBot(chatId, 'Описание слишком короткое. Опиши что показать в видео.');
    return;
  }
  await runAsyncTask(userId, chatId, 'VIDEO', prompt);
}

async function handleAnimatePrompt(userId: string, chatId: string, prompt: string, session: Session) {
  if (!session.animateImageUrl) {
    await sendBot(chatId, 'Картинка потеряна. Начни с /menu.');
    await clearSession(userId);
    return;
  }
  const motionPrompt = prompt === '.' ? undefined : prompt;
  await runAsyncTask(userId, chatId, 'ANIMATE', motionPrompt, session.animateImageUrl);
  await clearSession(userId);
}

async function runAsyncTask(
  userId: string,
  chatId: string,
  type: 'IMAGE' | 'VIDEO' | 'ANIMATE',
  prompt?: string,
  inputUrl?: string,
) {
  try {
    const settings = await getUserSettings(userId);
    const model =
      type === 'IMAGE' ? settings.imageModel
      : type === 'ANIMATE' ? settings.animateModel
      : settings.videoModel;
    const result = await startTask({
      userId,
      type,
      model,
      prompt,
      inputUrl,
      postToChatId: chatId,
    });
    const labels: Record<typeof type, string> = {
      IMAGE: 'картинку',
      ANIMATE: 'видео из картинки',
      VIDEO: 'видео',
    };
    const priceLine = result.estimatedPls === '0'
      ? '🎁 Бесплатно (admin)'
      : `💰 ${result.estimatedPls} PLS списано (вернётся если упадёт)`;
    await sendBot(
      chatId,
      `✨ Генерирую ${labels[type]}…\n\nМодель: ${model}\n${priceLine}\n\nОбычно занимает 30-90 секунд. Я пришлю результат сюда же.`,
    );
    // Reset to idle after launch — user can /menu or send another action.
    await clearSession(userId);
  } catch (e: any) {
    if (e instanceof PulsarGptError) {
      await sendBot(chatId, `⚠ ${e.message}\n\n/menu — вернуться в меню`);
    } else {
      console.error('[pulsar-gpt-handler] task launch error:', e);
      await sendBot(chatId, '⚠ Не получилось запустить задачу. Попробуй ещё раз или /menu.');
    }
  }
}
