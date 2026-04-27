import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import {
  STAKE_TIERS,
  MIN_STAKE,
  MAX_STAKE_PER_USER,
  EARLY_WITHDRAW_PENALTY_BPS,
  REWARDS_POOL,
  findTier,
  calcReward,
  canPayReward,
  rewardsPoolUsed,
  userActivePrincipal,
} from './staking.service.js';

export async function stakingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // Tiers + global pool snapshot for the picker UI.
  app.get('/tiers', async () => {
    const used = await rewardsPoolUsed();
    return {
      tiers: STAKE_TIERS,
      poolTotal: REWARDS_POOL.toString(),
      poolUsed: used.toString(),
      poolRemaining: (REWARDS_POOL - used).toString(),
      minStake: MIN_STAKE.toString(),
      maxStakePerUser: MAX_STAKE_PER_USER.toString(),
      earlyPenaltyBps: EARLY_WITHDRAW_PENALTY_BPS,
    };
  });

  // Current user's stakes.
  app.get('/my', async (request) => {
    const userId = request.user!.userId;
    const stakes = await prisma.stake.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
    });
    const now = Date.now();
    return {
      stakes: stakes.map((s) => ({
        id: s.id,
        amount: s.amount.toString(),
        lockDays: s.lockDays,
        apyBps: s.apyBps,
        startedAt: s.startedAt.toISOString(),
        maturesAt: s.maturesAt.toISOString(),
        status: s.status,
        withdrawnAt: s.withdrawnAt?.toISOString() ?? null,
        withdrawnAmount: s.withdrawnAmount?.toString() ?? null,
        rewardPaid: s.rewardPaid?.toString() ?? null,
        // Helpful on the client without recomputing.
        rewardEstimate: calcReward(s.amount, s.apyBps, s.lockDays).toString(),
        matured: s.maturesAt.getTime() <= now,
      })),
    };
  });

  // Open a new stake.
  app.post<{ Body: { amount: string; lockDays: number } }>(
    '/create',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { amount: amountStr, lockDays } = request.body;

      let amount: bigint;
      try { amount = BigInt(amountStr); } catch { return reply.status(400).send({ error: 'INVALID_AMOUNT' }); }

      if (amount < MIN_STAKE) {
        return reply.status(400).send({ error: 'BELOW_MIN', message: `Min ${MIN_STAKE} PLS` });
      }
      const tier = findTier(lockDays);
      if (!tier) return reply.status(400).send({ error: 'INVALID_TIER' });

      const wallet = await prisma.plsWallet.findUnique({ where: { userId } });
      if (!wallet || wallet.balance < amount) {
        return reply.status(402).send({ error: 'INSUFFICIENT_BALANCE' });
      }
      const alreadyLocked = await userActivePrincipal(userId);
      if (alreadyLocked + amount > MAX_STAKE_PER_USER) {
        return reply.status(400).send({
          error: 'EXCEEDS_USER_CAP',
          message: `Cap is ${MAX_STAKE_PER_USER} PLS per user; you have ${alreadyLocked} locked`,
        });
      }
      // Throttle if rewards pool would be exhausted by this stake's full payout.
      const reward = calcReward(amount, tier.apyBps, tier.lockDays);
      if (!(await canPayReward(reward))) {
        return reply.status(503).send({ error: 'POOL_EXHAUSTED', message: 'Staking rewards pool is full' });
      }

      const maturesAt = new Date(Date.now() + tier.lockDays * 24 * 3600 * 1000);

      const [stake] = await prisma.$transaction([
        prisma.stake.create({
          data: {
            userId,
            amount,
            lockDays: tier.lockDays,
            apyBps: tier.apyBps,
            maturesAt,
            status: 'ACTIVE',
          },
        }),
        prisma.plsWallet.update({
          where: { userId },
          data: { balance: { decrement: amount } },
        }),
        prisma.plsTransaction.create({
          data: {
            walletId: wallet.id,
            amount,
            type: 'PURCHASE', // closest existing enum; description disambiguates
            description: `Stake ${tier.lockDays}d`,
          },
        }),
      ]);
      return { stake };
    },
  );

  // Withdraw — returns principal+reward if matured, half-principal if early.
  app.post<{ Params: { id: string } }>(
    '/:id/withdraw',
    async (request, reply) => {
      const userId = request.user!.userId;
      const stake = await prisma.stake.findUnique({ where: { id: request.params.id } });
      if (!stake || stake.userId !== userId) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
      if (stake.status !== 'ACTIVE') {
        return reply.status(400).send({ error: 'NOT_ACTIVE' });
      }

      const matured = stake.maturesAt.getTime() <= Date.now();
      let payout: bigint;
      let reward: bigint;
      let nextStatus: 'WITHDRAWN' | 'EARLY_WITHDRAWN';

      if (matured) {
        reward = calcReward(stake.amount, stake.apyBps, stake.lockDays);
        // Pool guard at withdraw time too — payout might land after pool dried up.
        if (!(await canPayReward(reward))) {
          reward = 0n; // shrug — return principal only, log this somewhere later
        }
        payout = stake.amount + reward;
        nextStatus = 'WITHDRAWN';
      } else {
        // Early withdraw: -50% of principal, no reward.
        reward = 0n;
        payout = (stake.amount * BigInt(10_000 - EARLY_WITHDRAW_PENALTY_BPS)) / 10_000n;
        nextStatus = 'EARLY_WITHDRAWN';
      }

      const wallet = await prisma.plsWallet.upsert({
        where: { userId },
        create: { userId, balance: payout },
        update: { balance: { increment: payout } },
      });

      await prisma.$transaction([
        prisma.stake.update({
          where: { id: stake.id },
          data: {
            status: nextStatus,
            withdrawnAt: new Date(),
            withdrawnAmount: payout,
            rewardPaid: nextStatus === 'WITHDRAWN' ? reward : 0n,
          },
        }),
        prisma.plsTransaction.create({
          data: {
            walletId: wallet.id,
            amount: payout,
            type: 'REWARD',
            description: matured
              ? `Stake matured (${stake.lockDays}d, +${reward.toString()})`
              : `Stake early withdrawal (${stake.lockDays}d, -50% penalty)`,
          },
        }),
      ]);
      return {
        payout: payout.toString(),
        reward: reward.toString(),
        matured,
      };
    },
  );
}
