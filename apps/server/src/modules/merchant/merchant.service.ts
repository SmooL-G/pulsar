import { prisma } from '../../config/database.js';
import {
  MerchantTier,
  MerchantApplicationStatus,
  PlsTransactionType,
  P2PTradeStatus,
} from '@prisma/client';
import { recordBurn } from '../economy/burn.service.js';

/**
 * P2P Merchant tiers.
 *
 *   NONE     — regular L2+ user.
 *   TRUSTED  — auto-promoted by completed-trade stats. No fee.
 *   OFFICIAL — paid annual subscription, manually approved by admin.
 *              Featured placement, lower platform fee, large limits.
 *
 * Pricing (kept in PLS not USD so it auto-tracks the token's value):
 *   - Application fee:        500 PLS (non-refundable, even if rejected)
 *   - Annual subscription:  50,000 PLS (paid on approval; renewable)
 *
 * TRUSTED criteria (re-evaluated hourly by worker):
 *   - account ≥ 60 days old
 *   - ≥ 10 RELEASED trades total
 *   - 0 DISPUTED trades in last 30 days
 *
 * Auto-downgrade:
 *   - OFFICIAL → NONE when merchantExpiresAt passes (daily worker)
 *   - TRUSTED → NONE when criteria stop being met (hourly worker)
 */

export const APPLICATION_FEE_PLS = 500n;

// Tiered subscription pricing — longer commits get a discount.
// Keys are months; values are PLS price for that period.
export const SUBSCRIPTION_PRICES: Record<number, bigint> = {
  1: 5_000n,
  3: 14_000n,
  6: 26_000n,
  12: 48_000n,
};
export const SUBSCRIPTION_MONTHS = [1, 3, 6, 12] as const;
export type SubscriptionMonths = (typeof SUBSCRIPTION_MONTHS)[number];

/** Back-compat name for callers that haven't migrated to the tier table. */
export const ANNUAL_SUBSCRIPTION_PLS = SUBSCRIPTION_PRICES[12];

function priceFor(months: number): bigint {
  const price = SUBSCRIPTION_PRICES[months];
  if (!price) throw new MerchantError('INVALID_PERIOD', `Unsupported period: ${months} months`);
  return price;
}

const TRUSTED_MIN_ACCOUNT_AGE_DAYS = 60;
const TRUSTED_MIN_TRADES = 10;
const TRUSTED_DISPUTE_WINDOW_DAYS = 30;

export class MerchantError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'MerchantError';
  }
}

/** Charge a fixed PLS amount to a user; throws if balance insufficient.
 *  All merchant fees go straight to /dev/null (no recipient wallet),
 *  so each call also records a BURN entry — that's how the public
 *  economy stats endpoint shows "X PLS burned to date".
 */
async function debitPls(tx: any, userId: string, amount: bigint, description: string) {
  const wallet = await tx.plsWallet.findUnique({ where: { userId } });
  if (!wallet) throw new MerchantError('NO_WALLET', 'No PLS wallet');
  const spendable = wallet.balance - wallet.lockedAmount;
  if (spendable < amount) {
    throw new MerchantError('INSUFFICIENT_BALANCE', `Need ${amount} PLS, have ${spendable} spendable`);
  }
  await tx.plsWallet.update({
    where: { userId },
    data: { balance: { decrement: amount } },
  });
  await tx.plsTransaction.create({
    data: {
      walletId: wallet.id,
      type: PlsTransactionType.PURCHASE,
      amount: -amount,
      description,
    },
  });
  // 100% of merchant fees are burned (no recipient credit anywhere) —
  // make it explicit for the supply ledger.
  await recordBurn(tx, userId, amount, `Burn: ${description}`);
}

/** User submits a merchant application. Charges the application fee. */
export async function submitApplication(args: {
  userId: string;
  description: string;
  contactInfo?: string;
  /** Desired subscription length. Validated against SUBSCRIPTION_PRICES. */
  months?: number;
}) {
  if (args.description.trim().length < 30) {
    throw new MerchantError('DESCRIPTION_TOO_SHORT', 'Describe your business in at least 30 characters');
  }
  const requestedMonths = args.months ?? 12;
  // Validate the period upfront — no point storing 7 months if approval will fail.
  priceFor(requestedMonths);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: args.userId },
      select: { merchantTier: true, verificationLevel: true },
    });
    if (!user) throw new MerchantError('NOT_FOUND', 'User not found');
    if (user.merchantTier === MerchantTier.OFFICIAL) {
      throw new MerchantError('ALREADY_OFFICIAL', 'You are already an Official Merchant');
    }
    if ((user.verificationLevel ?? 0) < 2) {
      throw new MerchantError('VERIFICATION_REQUIRED', 'Need verification level 2+ to apply');
    }
    // Block multiple pending applications.
    const pending = await tx.merchantApplication.findFirst({
      where: { userId: args.userId, status: MerchantApplicationStatus.PENDING },
    });
    if (pending) throw new MerchantError('ALREADY_PENDING', 'You already have a pending application');

    await debitPls(tx, args.userId, APPLICATION_FEE_PLS, `Merchant application fee`);

    return tx.merchantApplication.create({
      data: {
        userId: args.userId,
        description: args.description.slice(0, 2000),
        contactInfo: args.contactInfo?.slice(0, 500) ?? null,
        applicationFeePls: APPLICATION_FEE_PLS,
        requestedMonths,
      },
    });
  });
}

/**
 * Admin approves an application. Charges the user for `months` of
 * subscription (1, 3, 6 or 12) — the user picked this when applying.
 */
export async function approveApplication(args: {
  applicationId: string;
  reviewerId: string;
  notes?: string;
  /** Override the months stored on the application (admin can shorten). */
  months?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.merchantApplication.findUnique({ where: { id: args.applicationId } });
    if (!app) throw new MerchantError('NOT_FOUND', 'Application not found');
    if (app.status !== MerchantApplicationStatus.PENDING) {
      throw new MerchantError('BAD_STATE', 'Application already reviewed');
    }
    const months = args.months ?? Number(app.requestedMonths ?? 12);
    const price = priceFor(months);
    await debitPls(tx, app.userId, price, `Merchant subscription (${months} mo)`);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    await tx.user.update({
      where: { id: app.userId },
      data: {
        merchantTier: MerchantTier.OFFICIAL,
        merchantExpiresAt: expiresAt,
        merchantSince: now,
      },
    });
    return tx.merchantApplication.update({
      where: { id: args.applicationId },
      data: {
        status: MerchantApplicationStatus.APPROVED,
        reviewedBy: args.reviewerId,
        reviewedAt: now,
        reviewNotes: args.notes?.slice(0, 500) ?? null,
      },
    });
  });
}

/** Admin rejects an application. Application fee stays in treasury. */
export async function rejectApplication(args: {
  applicationId: string;
  reviewerId: string;
  notes: string;
}) {
  const app = await prisma.merchantApplication.findUnique({ where: { id: args.applicationId } });
  if (!app) throw new MerchantError('NOT_FOUND', 'Application not found');
  if (app.status !== MerchantApplicationStatus.PENDING) {
    throw new MerchantError('BAD_STATE', 'Application already reviewed');
  }
  return prisma.merchantApplication.update({
    where: { id: args.applicationId },
    data: {
      status: MerchantApplicationStatus.REJECTED,
      reviewedBy: args.reviewerId,
      reviewedAt: new Date(),
      reviewNotes: args.notes.slice(0, 500),
    },
  });
}

/** Existing OFFICIAL merchant pays for another N months (1/3/6/12). */
export async function renewSubscription(userId: string, months: number = 12) {
  const price = priceFor(months);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { merchantTier: true, merchantExpiresAt: true },
    });
    if (!user) throw new MerchantError('NOT_FOUND', 'User not found');
    if (user.merchantTier !== MerchantTier.OFFICIAL) {
      throw new MerchantError('NOT_OFFICIAL', 'Only OFFICIAL merchants can renew');
    }
    await debitPls(tx, userId, price, `Merchant subscription renewal (${months} mo)`);
    // Extend from existing expiry if still valid; otherwise from now.
    const base = (user.merchantExpiresAt && user.merchantExpiresAt > new Date())
      ? user.merchantExpiresAt
      : new Date();
    const newExpiry = new Date(base.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    return tx.user.update({
      where: { id: userId },
      data: { merchantExpiresAt: newExpiry },
    });
  });
}

/** Admin force-revoke an OFFICIAL merchant (e.g., serious abuse). */
export async function revokeOfficial(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { merchantTier: MerchantTier.NONE, merchantExpiresAt: null },
  });
}

/**
 * Recompute TRUSTED tier for a single user. Returns the new tier.
 * Doesn't touch OFFICIAL — those are paid + admin-approved, separate path.
 */
export async function recomputeTrustedTier(userId: string): Promise<MerchantTier> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { merchantTier: true, createdAt: true },
  });
  if (!user) return MerchantTier.NONE;
  if (user.merchantTier === MerchantTier.OFFICIAL) return MerchantTier.OFFICIAL;

  const ageDays = (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays < TRUSTED_MIN_ACCOUNT_AGE_DAYS) {
    if (user.merchantTier !== MerchantTier.NONE) {
      await prisma.user.update({ where: { id: userId }, data: { merchantTier: MerchantTier.NONE } });
    }
    return MerchantTier.NONE;
  }

  const releasedCount = await prisma.p2PTrade.count({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      status: P2PTradeStatus.RELEASED,
    },
  });

  const disputeCutoff = new Date(Date.now() - TRUSTED_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const disputeCount = await prisma.p2PTrade.count({
    where: {
      OR: [{ buyerId: userId }, { sellerId: userId }],
      status: P2PTradeStatus.DISPUTED,
      createdAt: { gte: disputeCutoff },
    },
  });

  const qualifies = releasedCount >= TRUSTED_MIN_TRADES && disputeCount === 0;
  const target = qualifies ? MerchantTier.TRUSTED : MerchantTier.NONE;
  if (user.merchantTier !== target) {
    await prisma.user.update({ where: { id: userId }, data: { merchantTier: target } });
  }
  return target;
}

/** Background sweep — recompute TRUSTED for everyone with recent activity. */
export async function sweepTrustedTiers(): Promise<{ promoted: number; demoted: number }> {
  let promoted = 0;
  let demoted = 0;

  // Candidates: users with at least one trade in last 30d, OR currently
  // marked TRUSTED (so we can demote them if they fall out of criteria).
  const since = new Date(Date.now() - TRUSTED_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentTradeUserIds = await prisma.p2PTrade.findMany({
    where: { createdAt: { gte: since } },
    select: { buyerId: true, sellerId: true },
    distinct: ['buyerId'],
  });
  const userIds = new Set<string>();
  for (const t of recentTradeUserIds) {
    userIds.add(t.buyerId);
    userIds.add(t.sellerId);
  }
  const trusted = await prisma.user.findMany({
    where: { merchantTier: MerchantTier.TRUSTED },
    select: { id: true },
  });
  for (const t of trusted) userIds.add(t.id);

  for (const id of userIds) {
    const before = (await prisma.user.findUnique({ where: { id }, select: { merchantTier: true } }))?.merchantTier;
    const after = await recomputeTrustedTier(id);
    if (before !== MerchantTier.TRUSTED && after === MerchantTier.TRUSTED) promoted++;
    if (before === MerchantTier.TRUSTED && after !== MerchantTier.TRUSTED) demoted++;
  }
  return { promoted, demoted };
}

/** Daily worker tick: downgrade expired OFFICIAL subscriptions. */
export async function downgradeExpiredOfficial(): Promise<number> {
  const now = new Date();
  const expired = await prisma.user.findMany({
    where: {
      merchantTier: MerchantTier.OFFICIAL,
      merchantExpiresAt: { lt: now },
    },
    select: { id: true },
  });
  if (expired.length === 0) return 0;
  await prisma.user.updateMany({
    where: { id: { in: expired.map((u) => u.id) } },
    data: { merchantTier: MerchantTier.NONE, merchantExpiresAt: null },
  });
  return expired.length;
}
