import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { ReferralEarningType } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Referral system. Two-level commissions on mining + tiered one-shot
 * registration bonus to reward early adopters.
 *
 * Tiers (see signupTierBonus):
 *   1-100      → 200 PLS each (referrer + referee)
 *   101-1000   → 40 PLS
 *   1001-10000 → 10 PLS
 *   10000+     → 0 PLS (mining-% only)
 *
 * Mining commission (creditMiningCut):
 *   L1 (direct referrer) → 10% of every released NodeReward
 *   L2 (referrer's referrer) → 2%
 *
 * Soft cap (per referrer): 500 PLS / 24h from referral commissions
 * combined. Stops a viral leak from blowing up treasury overnight.
 */

const SOFT_CAP_PLS_PER_DAY = 500n;
const REDIS_DAILY_CAP_PREFIX = 'referrals:cap:'; // referrals:cap:<userId>:<YYYYMMDD>

/** Crockford-base32-ish, 8 chars: 32^8 ≈ 1 trillion combos. Collisions
 *  handled by retrying on the unique index. */
function generateCode(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/1/I/O for legibility
  const buf = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

/** Per-tier registration bonus in PLS. Returns 0 outside any tier. */
export function signupTierBonus(rank: number): bigint {
  if (rank >= 1 && rank <= 100) return 200n;
  if (rank <= 1000) return 40n;
  if (rank <= 10000) return 10n;
  return 0n;
}

/** Atomically reserves the next signupRank. Wraps a transaction so
 *  concurrent signups never collide. */
export async function nextSignupRank(): Promise<number> {
  const result = await prisma.$transaction(async (tx) => {
    const max = await tx.user.aggregate({ _max: { signupRank: true } });
    const next = (max._max.signupRank ?? 0) + 1;
    return next;
  });
  return result;
}

/**
 * Ensures a referralCode exists for the user. Idempotent; safe to call
 * lazily (e.g. on first /referrals/mine hit) so older accounts get one
 * without a backfill migration.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (u?.referralCode) return u.referralCode;

  // Retry on unique-violation in case of a collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
      return code;
    } catch (err) {
      // Prisma uniqueness violation → try again with a new code.
      if (attempt === 4) throw err;
    }
  }
  throw new Error('referral code generation exhausted retries');
}

/** Resolve a code to its owner userId. Returns null on miss. */
export async function findUserByReferralCode(code: string): Promise<string | null> {
  if (!code || code.length > 16) return null;
  const u = await prisma.user.findUnique({
    where: { referralCode: code.trim().toUpperCase() },
    select: { id: true },
  });
  return u?.id ?? null;
}

/**
 * Called from auth.routes register handler. Sets referredById +
 * signupRank atomically. Pass null `referredById` if no code or
 * invalid code. Registration bonus is granted later when verification
 * level reaches 1 — see grantRegistrationBonusIfReady().
 */
export async function attributeNewUser(
  userId: string,
  referredById: string | null,
): Promise<void> {
  const rank = await nextSignupRank();
  await prisma.user.update({
    where: { id: userId },
    data: {
      signupRank: rank,
      referredById,
    },
  });
}

/**
 * Grants the tier-based PLS bonus to BOTH the new user and their
 * referrer the moment the new user crosses Verification Level 1
 * (anti-empty-account gate). Idempotent — checked via referralBonusPaid.
 */
export async function grantRegistrationBonusIfReady(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      verificationLevel: true,
      referralBonusPaid: true,
      referredById: true,
      signupRank: true,
    },
  });
  if (!u) return;
  if (u.referralBonusPaid) return;
  if (u.verificationLevel < 1) return;

  const bonus = signupTierBonus(u.signupRank);
  if (bonus <= 0n) {
    // Mark paid even when 0 so we don't re-check forever.
    await prisma.user.update({ where: { id: userId }, data: { referralBonusPaid: true } });
    return;
  }

  const ops: any[] = [
    prisma.user.update({ where: { id: userId }, data: { referralBonusPaid: true } }),
    creditWallet(u.id, bonus),
    prisma.referralEarning.create({
      data: { earnerId: u.id, refereeId: u.id, type: ReferralEarningType.REGISTRATION, amount: bonus },
    }),
  ];
  if (u.referredById) {
    ops.push(creditWallet(u.referredById, bonus));
    ops.push(prisma.referralEarning.create({
      data: { earnerId: u.referredById, refereeId: u.id, type: ReferralEarningType.REGISTRATION, amount: bonus },
    }));
  }
  await prisma.$transaction(ops);
}

/** Tiny wallet credit helper — nodes.service has its own version with
 *  more bookkeeping; for referral bonuses the scope is smaller. */
function creditWallet(userId: string, amount: bigint) {
  return prisma.plsWallet.upsert({
    where: { userId },
    create: { userId, balance: amount },
    update: { balance: { increment: amount } },
  });
}

/**
 * Called from nodes.service.releasePendingRewards() right after a
 * node-mining reward is credited to the miner's wallet. Pays the
 * upstream chain (L1 = 10%, L2 = 2%) subject to the daily soft cap.
 *
 * Mining-only — registration bonus uses the separate path above.
 */
export async function creditMiningCut(args: {
  minerId: string;
  rewardAmount: bigint;
  sourceRewardId: string;
}): Promise<void> {
  const { minerId, rewardAmount, sourceRewardId } = args;
  if (rewardAmount <= 0n) return;

  const miner = await prisma.user.findUnique({
    where: { id: minerId },
    select: { referredById: true },
  });
  const l1Id = miner?.referredById ?? null;
  if (!l1Id) return;

  const l1Amount = (rewardAmount * 10n) / 100n;
  if (l1Amount > 0n) await tryPay(l1Id, minerId, l1Amount, ReferralEarningType.MINING_L1, sourceRewardId);

  // L2: ref-of-ref.
  const l1User = await prisma.user.findUnique({
    where: { id: l1Id },
    select: { referredById: true },
  });
  const l2Id = l1User?.referredById ?? null;
  if (l2Id) {
    const l2Amount = (rewardAmount * 2n) / 100n;
    if (l2Amount > 0n) await tryPay(l2Id, minerId, l2Amount, ReferralEarningType.MINING_L2, sourceRewardId);
  }
}

/**
 * Pays `amount` PLS to `earnerId` if doing so won't exceed the daily
 * 500-PLS soft cap (per earner). Truncates to whatever fits. Records
 * the ReferralEarning + wallet credit in one transaction.
 */
async function tryPay(
  earnerId: string,
  refereeId: string,
  amount: bigint,
  type: ReferralEarningType,
  sourceRewardId: string,
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `${REDIS_DAILY_CAP_PREFIX}${earnerId}:${day}`;

  // Read current daily total (PLS as string).
  const current = BigInt((await redis.get(key)) ?? '0');
  const remaining = SOFT_CAP_PLS_PER_DAY - current;
  if (remaining <= 0n) return;

  const finalAmount = amount < remaining ? amount : remaining;

  await prisma.$transaction([
    creditWallet(earnerId, finalAmount),
    prisma.referralEarning.create({
      data: { earnerId, refereeId, type, amount: finalAmount, sourceRewardId },
    }),
  ]);

  // Update redis counter (24h TTL).
  await redis.set(key, (current + finalAmount).toString(), 'EX', 86400);
}

/**
 * Dashboard payload for /referrals/mine. Returns the user's code,
 * counts of direct referrals, lifetime earnings split by type, and
 * recent earning rows (last 20).
 */
export async function getReferralDashboard(userId: string): Promise<{
  code: string;
  totalReferrals: number;
  earnedRegistration: string;
  earnedMiningL1: string;
  earnedMiningL2: string;
  recent: Array<{ id: string; type: string; amount: string; refereeId: string; createdAt: string }>;
}> {
  const code = await ensureReferralCode(userId);
  const [count, byType, recent] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.referralEarning.groupBy({
      by: ['type'],
      where: { earnerId: userId },
      _sum: { amount: true },
    }),
    prisma.referralEarning.findMany({
      where: { earnerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, type: true, amount: true, refereeId: true, createdAt: true },
    }),
  ]);

  const sumOf = (t: ReferralEarningType): bigint =>
    byType.find((r) => r.type === t)?._sum.amount ?? 0n;

  return {
    code,
    totalReferrals: count,
    earnedRegistration: sumOf(ReferralEarningType.REGISTRATION).toString(),
    earnedMiningL1: sumOf(ReferralEarningType.MINING_L1).toString(),
    earnedMiningL2: sumOf(ReferralEarningType.MINING_L2).toString(),
    recent: recent.map((r) => ({
      ...r,
      amount: r.amount.toString(),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
