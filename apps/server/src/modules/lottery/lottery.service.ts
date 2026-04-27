import { prisma } from '../../config/database.js';

export const MAIN_PRIZE = 10_000n;       // PLS
export const SMALL_PRIZE = 1_000n;       // PLS
export const MIN_COMMUNITY_SIZE = 50;    // verified members for "main" pool eligibility
export const MIN_VERIFICATION_LEVEL = 1; // user must be Level 1+ to participate
export const WIN_COOLDOWN_DAYS = 7;      // can't win again within this window
export const ACTIVITY_WINDOW_HOURS = 24; // counts as "active" if messaged in this window

export type LotteryPool = 'main' | 'small';

interface UserCandidate {
  id: string;
  username: string;
  displayName: string | null;
}

/** UserIds that won any pool within the cooldown window. */
async function recentlyWonUserIds(): Promise<string[]> {
  const since = new Date(Date.now() - WIN_COOLDOWN_DAYS * 24 * 3600 * 1000);
  const rows = await prisma.lotteryDraw.findMany({
    where: { drawnAt: { gte: since } },
    select: { winnerId: true },
  });
  return rows.map((r) => r.winnerId);
}

/** Chats that qualify as a "verified community with 50+ verified members". */
async function eligibleChatIdsForMain(): Promise<string[]> {
  const chats = await prisma.chat.findMany({
    where: { type: { in: ['GROUP', 'CHANNEL'] } },
    select: {
      id: true,
      _count: {
        select: {
          members: {
            where: {
              leftAt: null,
              user: { verificationLevel: { gte: MIN_VERIFICATION_LEVEL } },
            },
          },
        },
      },
    },
  });
  return chats.filter((c) => c._count.members >= MIN_COMMUNITY_SIZE).map((c) => c.id);
}

async function fetchCandidates(pool: LotteryPool): Promise<UserCandidate[]> {
  const blocked = await recentlyWonUserIds();
  const since = new Date(Date.now() - ACTIVITY_WINDOW_HOURS * 3600 * 1000);

  // Common filter: messaged in last 24h, in a group/channel, sender is
  // verified, not currently in cooldown.
  const baseWhere: any = {
    createdAt: { gte: since },
    isDeleted: false,
    chat: { type: { in: ['GROUP', 'CHANNEL'] } },
    sender: {
      verificationLevel: { gte: MIN_VERIFICATION_LEVEL },
      isBot: false,
    },
    ...(blocked.length > 0 ? { senderId: { notIn: blocked } } : {}),
  };

  if (pool === 'main') {
    const eligibleIds = await eligibleChatIdsForMain();
    if (eligibleIds.length === 0) return [];
    baseWhere.chatId = { in: eligibleIds };
  }
  // For 'small': any group/channel where messages drew at least 3 unique
  // recipients. Cheap proxy: look at chats with 3+ active members.
  // (We'd otherwise need to scan ChatMember per message — expensive.)
  if (pool === 'small') {
    const small = await prisma.chat.findMany({
      where: {
        type: { in: ['GROUP', 'CHANNEL'] },
        members: { some: { leftAt: null } },
      },
      select: {
        id: true,
        _count: { select: { members: { where: { leftAt: null } } } },
      },
    });
    const ids = small.filter((c) => c._count.members >= 3).map((c) => c.id);
    if (ids.length === 0) return [];
    baseWhere.chatId = { in: ids };
  }

  const rows = await prisma.message.findMany({
    where: baseWhere,
    select: {
      senderId: true,
      sender: { select: { id: true, username: true, displayName: true } },
    },
    distinct: ['senderId'],
    take: 5000,
  });
  return rows
    .map((r) => r.sender)
    .filter((u): u is UserCandidate => !!u);
}

/**
 * Run a single draw for `pool`. Returns the draw row (and credits the
 * winner's wallet) or null if there were no eligible candidates.
 */
export async function drawPool(pool: LotteryPool) {
  const candidates = await fetchCandidates(pool);
  if (candidates.length === 0) return null;

  const winner = candidates[Math.floor(Math.random() * candidates.length)];
  const amount = pool === 'main' ? MAIN_PRIZE : SMALL_PRIZE;

  const wallet = await prisma.plsWallet.upsert({
    where: { userId: winner.id },
    create: { userId: winner.id, balance: amount },
    update: { balance: { increment: amount } },
  });

  const [draw] = await prisma.$transaction([
    prisma.lotteryDraw.create({
      data: {
        pool,
        winnerId: winner.id,
        amount,
        candidatesCount: candidates.length,
      },
    }),
    prisma.plsTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: 'REWARD',
        description: pool === 'main'
          ? `Daily lottery (main pool)`
          : `Daily lottery (small pool)`,
      },
    }),
  ]);

  return { draw, winner };
}

/** Has either pool been drawn within the last 23 hours? */
export async function alreadyDrawnToday(): Promise<boolean> {
  const since = new Date(Date.now() - 23 * 3600 * 1000);
  const count = await prisma.lotteryDraw.count({ where: { drawnAt: { gte: since } } });
  return count >= 2; // both pools drawn
}
