import { prisma } from '../../config/database.js';

export interface StakeTier {
  lockDays: number;
  apyBps: number; // basis points: 200 = 2.00% APY
}

/** Available staking tiers — kept conservative on purpose (see roadmap notes). */
export const STAKE_TIERS: StakeTier[] = [
  { lockDays: 7,   apyBps: 200 },   // 2% APY
  { lockDays: 30,  apyBps: 500 },   // 5% APY
  { lockDays: 90,  apyBps: 1000 },  // 10% APY
  { lockDays: 365, apyBps: 2000 },  // 20% APY
];

export const MIN_STAKE = 100n;                    // floor: 100 PLS
export const MAX_STAKE_PER_USER = 1_000_000n;     // cap: 1M PLS
export const EARLY_WITHDRAW_PENALTY_BPS = 5_000;  // 50% of principal returned, no reward

// 1% of total supply earmarked for staking rewards. Once this pool is
// drained, new stakes still work but APY is throttled to 0% so the bank
// doesn't keep printing forever.
export const TOTAL_SUPPLY = 22_000_000_000_000_000n;
export const REWARDS_POOL = TOTAL_SUPPLY / 100n; // 1% = 220T PLS

export function findTier(lockDays: number): StakeTier | undefined {
  return STAKE_TIERS.find((t) => t.lockDays === lockDays);
}

/** Reward = principal * apyBps/10000 * (lockDays/365). BigInt math. */
export function calcReward(principal: bigint, apyBps: number, lockDays: number): bigint {
  // (principal * apyBps * lockDays) / (10000 * 365)
  return (principal * BigInt(apyBps) * BigInt(lockDays)) / (10_000n * 365n);
}

/** Total rewards already paid out across all WITHDRAWN stakes. */
export async function rewardsPoolUsed(): Promise<bigint> {
  const agg = await prisma.stake.aggregate({
    _sum: { rewardPaid: true },
    where: { status: 'WITHDRAWN' },
  });
  return agg._sum.rewardPaid ?? 0n;
}

/** Returns true if the rewards pool can still cover a `reward` payout. */
export async function canPayReward(reward: bigint): Promise<boolean> {
  const used = await rewardsPoolUsed();
  return used + reward <= REWARDS_POOL;
}

/** Sum of currently-locked principal for a user (only ACTIVE stakes). */
export async function userActivePrincipal(userId: string): Promise<bigint> {
  const agg = await prisma.stake.aggregate({
    _sum: { amount: true },
    where: { userId, status: 'ACTIVE' },
  });
  return agg._sum.amount ?? 0n;
}
