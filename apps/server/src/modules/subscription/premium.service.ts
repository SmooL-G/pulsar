import { prisma } from '../../config/database.js';

export const PREMIUM_MONTH_PRICE_PLS = 5000n;
export const PREMIUM_TRIAL_DAYS = 7;
export const PREMIUM_PERIOD_DAYS = 30;

/** True iff the user has an active (non-expired) Subscription row. */
export async function isPremium(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { expiresAt: true },
  });
  return !!sub && sub.expiresAt.getTime() > Date.now();
}

/** Bulk check — single query, returns Set of premium userIds. */
export async function getPremiumUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const subs = await prisma.subscription.findMany({
    where: { userId: { in: userIds }, expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  return new Set(subs.map((s) => s.userId));
}

/** Map verification + premium → effective per-user limits. */
export interface EffectiveLimits {
  fileSize: number;        // bytes
  filesPerMessage: number;
  ownedChannels: number;
}

export function getEffectiveLimits(opts: {
  verificationLevel: number;
  role: string;
  isPremium: boolean;
}): EffectiveLimits {
  const { verificationLevel, role, isPremium } = opts;
  // File size: 20MB free, 50MB Pro, 100MB Premium/Elite/admin
  let fileSize = 20 * 1024 * 1024;
  if (verificationLevel >= 2) fileSize = 50 * 1024 * 1024;
  if (isPremium || verificationLevel >= 3 || role === 'ADMIN' || role === 'SUPER_ADMIN') {
    fileSize = 100 * 1024 * 1024;
  }
  return {
    fileSize,
    filesPerMessage: isPremium ? 20 : 5,
    ownedChannels: isPremium ? 10 : 3,
  };
}
