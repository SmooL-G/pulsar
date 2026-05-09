import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { getIO } from '../../socket/index.js';
import { PULSAR_GPT_BOT_USER_ID } from './pulsar-gpt.seed.js';
import { runChat, startTask, getUserSettings, PulsarGptError } from './pulsar-gpt.service.js';

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
  [
    { text: '💬 Чат с ИИ', callbackData: 'gpt:chat' },
    { text: '🎨 Картинка', callbackData: 'gpt:image' },
  ],
  [
    { text: '🎬 Оживить', callbackData: 'gpt:animate' },
    { text: '🎥 Видео', callbackData: 'gpt:video' },
  ],
  [
    { text: '⚙ Настройки (страница)', callbackData: 'gpt:settings' },
  ],
];

async function showMenu(chatId: string) {
  await sendBot(
    chatId,
    '🤖 Pulsar GPT — выбери что делать:',
    MENU_BUTTONS,
  );
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
    await showMenu(chatId);
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
      await showMenu(chatId);
      return;
  }
}

async function handleCallback(userId: string, chatId: string, data: string) {
  const action = data.slice(4); // strip "gpt:"
  switch (action) {
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
    case 'settings':
      await sendBot(
        chatId,
        '⚙ Настройки моделей и баланса — на странице:\n👉 https://pulsar-chat.fun/pulsar-gpt',
      );
      return;
    default:
      await showMenu(chatId);
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
