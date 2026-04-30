import { prisma } from '../../config/database.js';

export const BOOST_COST = 1_000n;          // PLS per slot
export const BOOST_DURATION_DAYS = 30;
export const LEVEL_THRESHOLDS = [10, 25, 50] as const; // active boosts → level
export const MAX_LEVEL = LEVEL_THRESHOLDS.length;

export interface LevelPerks {
  // Hard caps that the rest of the server checks against. Keeping
  // them in one place means the boost-perk effect stays consistent
  // regardless of where the limit is enforced.
  fileLimitMb: number;
  emojiSlots: number;
  maxMembers: number;
  hdAvatar: boolean;
  hasBanner: boolean;
  vipSearchRank: boolean;
}

const PERKS_BY_LEVEL: Record<number, LevelPerks> = {
  0: { fileLimitMb: 20, emojiSlots: 0,  maxMembers: 500,  hdAvatar: false, hasBanner: false, vipSearchRank: false },
  1: { fileLimitMb: 50, emojiSlots: 25, maxMembers: 500,  hdAvatar: true,  hasBanner: false, vipSearchRank: false },
  2: { fileLimitMb: 100, emojiSlots: 50, maxMembers: 1000, hdAvatar: true,  hasBanner: true,  vipSearchRank: false },
  3: { fileLimitMb: 250, emojiSlots: 100, maxMembers: 5000, hdAvatar: true,  hasBanner: true,  vipSearchRank: true },
};

export function levelForActiveCount(active: number): number {
  let lvl = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (active >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
  }
  return lvl;
}

export function perksFor(level: number): LevelPerks {
  return PERKS_BY_LEVEL[Math.min(level, MAX_LEVEL)] ?? PERKS_BY_LEVEL[0];
}

export class BoostError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/**
 * Buy a single boost slot for a chat. Atomically debits PLS, creates
 * the row, returns the freshly-derived chat-level info so the caller
 * can broadcast it to everyone in the room.
 */
export async function boostChat(userId: string, chatId: string) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { id: true, type: true, ownerId: true },
  });
  if (!chat) throw new BoostError('NOT_FOUND', 'Chat not found');
  if (chat.type !== 'GROUP' && chat.type !== 'CHANNEL') {
    throw new BoostError('WRONG_CHAT_TYPE', 'Only groups and channels can be boosted');
  }
  // Owner gets the same benefit as everyone else from boosts so they
  // can also boost their own; the perk side-effect doesn't enrich them.

  const member = await prisma.chatMember.findFirst({
    where: { chatId, userId, leftAt: null },
    select: { id: true },
  });
  if (!member) throw new BoostError('NOT_MEMBER', 'Join the chat before boosting');

  const wallet = await prisma.plsWallet.findUnique({ where: { userId } });
  if (!wallet) throw new BoostError('NO_WALLET', 'Wallet not found');
  if (wallet.balance < BOOST_COST) {
    throw new BoostError('INSUFFICIENT_FUNDS', `Need ${BOOST_COST} PLS to boost`);
  }

  const expiresAt = new Date(Date.now() + BOOST_DURATION_DAYS * 24 * 3600 * 1000);

  await prisma.$transaction([
    prisma.plsWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: BOOST_COST } },
    }),
    prisma.plsTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -BOOST_COST,
        type: 'TRANSFER',
        description: `Channel boost (chat ${chatId.slice(0, 8)})`,
      },
    }),
    prisma.channelBoost.create({
      data: { chatId, userId, amount: BOOST_COST, expiresAt },
    }),
  ]);

  const info = await getChatBoostInfo(chatId);
  return { ...info, balance: (wallet.balance - BOOST_COST).toString() };
}

export async function getChatBoostInfo(chatId: string) {
  const now = new Date();
  const active = await prisma.channelBoost.findMany({
    where: { chatId, expiresAt: { gt: now } },
    orderBy: { expiresAt: 'desc' },
    take: 200,
  });

  const level = levelForActiveCount(active.length);
  const perks = perksFor(level);

  // Top boosters: count slots per user across the active set.
  const counts = new Map<string, number>();
  for (const b of active) counts.set(b.userId, (counts.get(b.userId) ?? 0) + 1);
  const topUserIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const users = topUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topUserIds.map(([id]) => id) } },
        select: { id: true, username: true, displayName: true, avatarUrl: true, nickColor: true, avatarFrame: true, bubbleColor: true, role: true, verificationLevel: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const nextThreshold = level < MAX_LEVEL ? LEVEL_THRESHOLDS[level] : null;
  const earliestExpiry = active[active.length - 1]?.expiresAt ?? null;

  return {
    chatId,
    activeCount: active.length,
    level,
    nextThreshold,
    perks,
    earliestExpiry: earliestExpiry?.toISOString() ?? null,
    topBoosters: topUserIds.map(([id, count]) => ({
      user: userMap.get(id) ?? { id, username: id.slice(0, 8) },
      count,
    })),
    cost: BOOST_COST.toString(),
    durationDays: BOOST_DURATION_DAYS,
  };
}

export async function getMyBoosts(userId: string) {
  const now = new Date();
  const rows = await prisma.channelBoost.findMany({
    where: { userId, expiresAt: { gt: now } },
    orderBy: { expiresAt: 'asc' },
  });
  return rows.map((r) => ({
    chatId: r.chatId,
    startedAt: r.startedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    amount: r.amount.toString(),
  }));
}
