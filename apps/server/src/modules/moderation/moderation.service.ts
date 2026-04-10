/**
 * Moderation service — создание мод-чата, применение наказаний.
 */
import { prisma } from '../../config/database.js';
import { getIO } from '../../socket/index.js';

const VOTE_THRESHOLD = 10;

// Анонимизация: показываем User#XXXX вместо настоящего имени
export function anonymizeUserId(userId: string): string {
  const hash = userId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `User#${hash}`;
}

/**
 * Получить или создать системный мод-чат.
 * Добавляет всех MODERATOR/ADMIN/SUPER_ADMIN как OWNER.
 */
export async function getOrCreateModChannel(): Promise<string> {
  const existing = await prisma.chat.findFirst({
    where: { isModChannel: true },
    select: { id: true },
  });
  if (existing) return existing.id;

  const modChat = await prisma.chat.create({
    data: {
      type: 'GROUP',
      name: '🛡️ Moderation',
      description: 'System moderation channel — reports & verdicts',
      isModChannel: true,
      isPublic: false,
    },
  });

  // Добавляем всех модераторов/админов
  const mods = await prisma.user.findMany({
    where: { role: { in: ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true },
  });

  if (mods.length > 0) {
    await prisma.chatMember.createMany({
      data: mods.map((m) => ({
        chatId: modChat.id,
        userId: m.id,
        role: 'MODERATOR' as const,
      })),
      skipDuplicates: true,
    });
  }

  return modChat.id;
}

/**
 * Добавить нового модератора в мод-чат при назначении.
 */
export async function addModeratorToModChannel(userId: string): Promise<void> {
  const chatId = await getOrCreateModChannel();
  await prisma.chatMember.upsert({
    where: { chatId_userId: { chatId, userId } },
    create: { chatId, userId, role: 'MODERATOR' },
    update: { leftAt: null, role: 'MODERATOR' },
  });
}

/**
 * Отправить карточку репорта в мод-чат как SYSTEM-сообщение.
 */
export async function postReportToModChannel(reportId: string, reportedContent: string, reason: string): Promise<void> {
  const chatId = await getOrCreateModChannel();

  // Находим любого системного юзера для senderId (первый SUPER_ADMIN)
  const sysUser = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  });
  if (!sysUser) return;

  const msg = await prisma.message.create({
    data: {
      chatId,
      senderId: sysUser.id,
      type: 'SYSTEM',
      content: null,
      metadata: {
        isReport: true,
        reportId,
        reportedContent,
        reason,
        votes: {},
        voteCount: 0,
      },
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  const io = getIO();
  if (io) {
    io.to(`chat:${chatId}`).emit('message:new', {
      id: msg.id,
      chatId,
      senderId: msg.senderId,
      content: null,
      type: 'SYSTEM',
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

/**
 * Применить наказание после достижения порога голосов.
 */
export async function applyPunishment(reportId: string, verdict: string): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: { message: { select: { senderId: true } } },
  });
  if (!report || report.status !== 'PENDING') return;

  const targetUserId = report.message.senderId;
  const now = new Date();

  if (verdict === 'DISMISS') {
    await prisma.report.update({ where: { id: reportId }, data: { status: 'DISMISSED' } });
    return;
  }

  let punishmentType: 'WARN' | 'MUTE' | 'BAN' = 'WARN';
  let expiresAt: Date | null = null;
  let newStatus: any = 'RESOLVED_WARN';

  if (verdict === 'WARN') {
    punishmentType = 'WARN';
    newStatus = 'RESOLVED_WARN';
  } else if (verdict.startsWith('MUTE')) {
    punishmentType = 'MUTE';
    newStatus = 'RESOLVED_MUTE';
    const hours = verdict === 'MUTE_1H' ? 1 : verdict === 'MUTE_24H' ? 24 : 24 * 7;
    expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
    // Обновляем все чаты пользователя — ставим mutedUntil
    await prisma.chatMember.updateMany({
      where: { userId: targetUserId, leftAt: null },
      data: { mutedUntil: expiresAt },
    });
  } else if (verdict.startsWith('BAN')) {
    punishmentType = 'BAN';
    newStatus = 'RESOLVED_BAN';
    expiresAt = verdict === 'BAN_30D' ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
    await prisma.user.update({
      where: { id: targetUserId },
      data: { status: 'BANNED' },
    });
  }

  await Promise.all([
    prisma.report.update({ where: { id: reportId }, data: { status: newStatus } }),
    prisma.userPunishment.create({
      data: { userId: targetUserId, type: punishmentType, expiresAt, reportId },
    }),
  ]);
}

/**
 * Подсчитать голоса и вернуть доминирующий вердикт если порог достигнут.
 */
export async function checkVoteThreshold(reportId: string): Promise<string | null> {
  const votes = await prisma.modVote.findMany({ where: { reportId } });
  const counts: Record<string, number> = {};
  for (const v of votes) {
    counts[v.verdict] = (counts[v.verdict] || 0) + 1;
  }
  for (const [verdict, count] of Object.entries(counts)) {
    if (count >= VOTE_THRESHOLD) return verdict;
  }
  return null;
}
