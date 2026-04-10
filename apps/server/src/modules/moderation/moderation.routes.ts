import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/auth.js';
import { getIO } from '../../socket/index.js';
import {
  anonymizeUserId,
  postReportToModChannel,
  checkVoteThreshold,
  applyPunishment,
  getOrCreateModChannel,
} from './moderation.service.js';

const MOD_ROLES = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'];

export async function moderationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // POST /moderation/report — пожаловаться на сообщение
  app.post<{
    Body: { messageId: string; reason: string };
  }>('/report', async (request, reply) => {
    const userId = request.user!.userId;
    const { messageId, reason } = request.body;

    const validReasons = ['SPAM', 'HARASSMENT', 'ILLEGAL', 'VIOLENCE', 'OTHER'];
    if (!messageId || !validReasons.includes(reason)) {
      return reply.status(400).send({ error: 'INVALID_INPUT' });
    }

    // Нельзя жаловаться на свои сообщения
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, content: true, isDeleted: true },
    });
    if (!message || message.isDeleted) {
      return reply.status(404).send({ error: 'MESSAGE_NOT_FOUND' });
    }
    if (message.senderId === userId) {
      return reply.status(400).send({ error: 'CANNOT_REPORT_OWN' });
    }

    // Нельзя дважды пожаловаться на одно сообщение
    const existing = await prisma.report.findFirst({
      where: { messageId, reporterId: userId, status: 'PENDING' },
    });
    if (existing) {
      return reply.status(409).send({ error: 'ALREADY_REPORTED' });
    }

    const report = await prisma.report.create({
      data: { messageId, reporterId: userId, reason: reason as any },
    });

    // Отправляем анонимную карточку в мод-чат
    const content = message.content || '[медиа]';
    await postReportToModChannel(report.id, content, reason);

    return { success: true };
  });

  // POST /moderation/vote — голос модератора
  app.post<{
    Body: { reportId: string; verdict: string };
  }>('/vote', async (request, reply) => {
    const userId = request.user!.userId;
    const { reportId, verdict } = request.body;

    // Только модераторы
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || !MOD_ROLES.includes(user.role)) {
      return reply.status(403).send({ error: 'NOT_MODERATOR' });
    }

    const validVerdicts = ['WARN', 'MUTE_1H', 'MUTE_24H', 'MUTE_7D', 'BAN_30D', 'BAN_PERM', 'DISMISS'];
    if (!validVerdicts.includes(verdict)) {
      return reply.status(400).send({ error: 'INVALID_VERDICT' });
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true },
    });
    if (!report || report.status !== 'PENDING') {
      return reply.status(400).send({ error: 'REPORT_NOT_PENDING' });
    }

    // Upsert голос (можно изменить своё решение)
    await prisma.modVote.upsert({
      where: { reportId_moderatorId: { reportId, moderatorId: userId } },
      create: { reportId, moderatorId: userId, verdict: verdict as any },
      update: { verdict: verdict as any },
    });

    // Считаем голоса
    const votes = await prisma.modVote.findMany({ where: { reportId } });
    const counts: Record<string, number> = {};
    for (const v of votes) counts[v.verdict] = (counts[v.verdict] || 0) + 1;

    // Проверяем порог
    const dominant = await checkVoteThreshold(reportId);
    if (dominant) {
      await applyPunishment(reportId, dominant);
    }

    // Сохраняем счётчики голосов в метадату системного сообщения
    const modChatId = await getOrCreateModChannel();
    const sysMsg = await prisma.message.findFirst({
      where: {
        chatId: modChatId,
        type: 'SYSTEM',
        metadata: { path: ['reportId'], equals: reportId },
      },
      select: { id: true, metadata: true },
    });
    if (sysMsg) {
      await prisma.message.update({
        where: { id: sysMsg.id },
        data: {
          metadata: {
            ...(sysMsg.metadata as object),
            votes: counts,
            voteCount: votes.length,
            resolved: !!dominant,
          },
        },
      });
    }

    // Обновляем карточку в мод-чате через socket
    const io = getIO();
    if (io) {
      io.to(`chat:${modChatId}`).emit('report:votes-updated', {
        reportId,
        counts,
        resolved: !!dominant,
        verdict: dominant,
      });
    }

    return { success: true, counts, resolved: !!dominant };
  });

  // GET /moderation/mod-chat — получить ID мод-чата
  app.get('/mod-chat', async (request, reply) => {
    const userId = request.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user || !MOD_ROLES.includes(user.role)) {
      return reply.status(403).send({ error: 'NOT_MODERATOR' });
    }
    const chatId = await getOrCreateModChannel();
    return { chatId };
  });
}
