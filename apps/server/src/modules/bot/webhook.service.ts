import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { getIO } from '../../socket/index.js';

export interface MessageAttachment {
  id?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  url: string;
}

export interface MessagePayload {
  id: string;
  chatId: string;
  senderId: string;
  content: string | null;
  type: string;
  replyToId: string | null;
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    displayName: string | null;
  };
  attachments?: MessageAttachment[];
}

function buildUpdatePayload(type: string, message: MessagePayload) {
  return {
    type,
    message: {
      id: message.id,
      chatId: message.chatId,
      from: message.sender
        ? { id: message.sender.id, username: message.sender.username, displayName: message.sender.displayName }
        : null,
      text: message.content,
      date: message.createdAt,
      replyToId: message.replyToId,
      attachments: message.attachments ?? [],
    },
  };
}

export async function dispatchBotUpdates(message: MessagePayload) {
  try {
    // Найти всех бот-участников чата (кроме самого отправителя)
    const botMembers = await prisma.chatMember.findMany({
      where: {
        chatId: message.chatId,
        leftAt: null,
        NOT: { userId: message.senderId },
        user: { isBot: true },
      },
      include: {
        user: {
          include: { botProfile: true },
        },
      },
    });

    for (const member of botMembers) {
      const bot = (member.user as any).botProfile;
      if (!bot || !bot.isActive || bot.isSystemBot) continue;

      const isCommand = message.content?.startsWith('/');
      const updateType = isCommand ? 'command' : 'message';
      const payload = buildUpdatePayload(updateType, message);

      // Сохранить в очередь long-poll
      const update = await prisma.botUpdate.create({
        data: { botId: bot.id, type: updateType, payload },
      });

      // Сигнал waiting long-pollers
      await redis.publish(`bot:updates:${bot.id}`, String(update.id));

      // Если вебхук настроен — в очередь доставки
      if (bot.webhookUrl) {
        await redis.rpush(
          'bot:webhook:queue',
          JSON.stringify({
            botId: bot.id,
            updateId: update.id.toString(),
            webhookUrl: bot.webhookUrl,
            webhookSecret: bot.webhookSecret,
            payload,
            attempt: 0,
            nextRetryAt: Date.now(),
          })
        );
      }
    }
  } catch (err) {
    // Never block message delivery
    console.error('[BotDispatch] error:', err);
  }
}

/**
 * Dispatch a callback query (inline button press) to a specific bot.
 */
export async function dispatchBotCallback(bot: { id: string; webhookUrl: string | null; webhookSecret: string | null }, payload: unknown) {
  try {
    const update = await prisma.botUpdate.create({
      data: { botId: bot.id, type: 'callback_query', payload: payload as any },
    });

    await redis.publish(`bot:updates:${bot.id}`, String(update.id));

    if (bot.webhookUrl) {
      await redis.rpush('bot:webhook:queue', JSON.stringify({
        botId: bot.id,
        updateId: update.id.toString(),
        webhookUrl: bot.webhookUrl,
        webhookSecret: bot.webhookSecret,
        payload,
        attempt: 0,
        nextRetryAt: Date.now(),
      }));
    }
  } catch (err) {
    console.error('[BotCallback] error:', err);
  }
}
