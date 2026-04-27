import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { sendPushToUser } from '../push/push.service.js';

export const MEMBERS_PER_PLS = 10;          // 1 PLS per 10 active members
export const MIN_VERIFIED_MEMBERS = 50;     // chat eligibility threshold
export const MIN_VERIFICATION_LEVEL = 1;
export const ACTIVE_WINDOW_DAYS = 7;        // member is "active" if posted within window
export const MAX_CHATS_PER_OWNER = 3;       // top-N by activeCount

const REDIS_ENABLED_KEY = 'setting:revenue.enabled';

export async function isRevenueEnabled(): Promise<boolean> {
  const v = await redis.get(REDIS_ENABLED_KEY);
  return v !== 'false';
}

export async function setRevenueEnabled(enabled: boolean): Promise<void> {
  await redis.set(REDIS_ENABLED_KEY, enabled ? 'true' : 'false');
}

interface ChatCandidate {
  chatId: string;
  ownerId: string;
  activeCount: number;
}

/** Distribute one round (called daily by the worker). */
export async function distributeRevenue() {
  if (!(await isRevenueEnabled())) return { distributed: 0, totalPaid: 0n };

  const now = Date.now();
  const since = new Date(now - ACTIVE_WINDOW_DAYS * 24 * 3600 * 1000);

  // 1. Eligible chats: GROUP/CHANNEL with verified owner who is currently
  //    Premium AND has 50+ verified members.
  const chats = await prisma.chat.findMany({
    where: {
      type: { in: ['GROUP', 'CHANNEL'] },
      ownerId: { not: null },
      owner: {
        verificationLevel: { gte: MIN_VERIFICATION_LEVEL },
        subscription: { expiresAt: { gt: new Date() } },
      },
    },
    select: {
      id: true,
      ownerId: true,
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
  const eligibleIds = chats
    .filter((c) => c._count.members >= MIN_VERIFIED_MEMBERS && c.ownerId)
    .map((c) => ({ chatId: c.id, ownerId: c.ownerId! }));
  if (eligibleIds.length === 0) return { distributed: 0, totalPaid: 0n };

  // 2. For each eligible chat, count distinct active senders in last 7 days.
  const candidates: ChatCandidate[] = [];
  for (const { chatId, ownerId } of eligibleIds) {
    const activeRows = await prisma.message.findMany({
      where: {
        chatId,
        createdAt: { gte: since },
        isDeleted: false,
        sender: { isBot: false },
      },
      select: { senderId: true },
      distinct: ['senderId'],
    });
    candidates.push({ chatId, ownerId, activeCount: activeRows.length });
  }

  // 3. Cap at MAX_CHATS_PER_OWNER per owner — keep most active.
  const byOwner = new Map<string, ChatCandidate[]>();
  for (const c of candidates) {
    const arr = byOwner.get(c.ownerId) || [];
    arr.push(c);
    byOwner.set(c.ownerId, arr);
  }
  const final: ChatCandidate[] = [];
  for (const [, arr] of byOwner) {
    arr.sort((a, b) => b.activeCount - a.activeCount);
    final.push(...arr.slice(0, MAX_CHATS_PER_OWNER));
  }

  // 4. Distribute. activeCount/10 PLS, integer-floor; skip < 1 PLS payouts.
  let totalPaid = 0n;
  let distributed = 0;
  for (const c of final) {
    const amount = BigInt(Math.floor(c.activeCount / MEMBERS_PER_PLS));
    if (amount === 0n) continue;

    const wallet = await prisma.plsWallet.upsert({
      where: { userId: c.ownerId },
      create: { userId: c.ownerId, balance: amount },
      update: { balance: { increment: amount } },
    });

    await prisma.$transaction([
      prisma.revenueDistribution.create({
        data: {
          chatId: c.chatId,
          ownerId: c.ownerId,
          amount,
          activeCount: c.activeCount,
        },
      }),
      prisma.plsTransaction.create({
        data: {
          walletId: wallet.id,
          amount,
          type: 'REWARD',
          description: `Channel revenue (${c.activeCount} active)`,
        },
      }),
    ]);

    totalPaid += amount;
    distributed++;

    sendPushToUser(c.ownerId, {
      title: '💰 Доход от сообщества',
      body: `+${amount.toString()} PLS за активность ${c.activeCount} участников`,
      url: '/?settings=admin',
      tag: `revenue:${c.chatId}:${Date.now()}`,
    }).catch(() => {});
  }

  return { distributed, totalPaid };
}

/** True if any distribution happened in the last 23h (idempotency guard). */
export async function alreadyDistributedToday(): Promise<boolean> {
  const since = new Date(Date.now() - 23 * 3600 * 1000);
  const count = await prisma.revenueDistribution.count({
    where: { distributedAt: { gte: since } },
  });
  return count > 0;
}
