import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';

const REDIS_ENABLED_KEY = 'setting:treasury.enabled';

export const PROPOSAL_DEPOSIT = 1_000n;        // PLS taken from author at create time
export const MIN_BALANCE_TO_CREATE = 100n;     // wallet must have at least this AFTER deposit
export const MIN_VERIFICATION_LEVEL = 1;       // must be at least Level 1 to create
export const VOTING_PERIOD_DAYS = 7;
export const QUORUM_VOTES = 100;               // unique voters required for quorum
export const VOTE_REWARD = 5n;                 // PLS paid to each voter
export const TITLE_MIN = 6;
export const TITLE_MAX = 120;
export const DESCRIPTION_MIN = 20;
export const DESCRIPTION_MAX = 4000;

export async function isTreasuryEnabled(): Promise<boolean> {
  const v = await redis.get(REDIS_ENABLED_KEY);
  return v !== 'false';
}

export async function setTreasuryEnabled(enabled: boolean): Promise<void> {
  await redis.set(REDIS_ENABLED_KEY, enabled ? 'true' : 'false');
}

/**
 * Quadratic voting: weight = floor(sqrt(balance_in_PLS)).
 * Whales pay √N for N voting power. We compute on the integer balance
 * (no fractional PLS exists), so a voter with 10 000 PLS has 100 power,
 * 1 000 000 PLS → 1000 power. Minimum power for a voter with > 0 PLS is 1.
 */
export function quadraticPower(balance: bigint): bigint {
  if (balance <= 0n) return 0n;
  // BigInt sqrt via Newton's method.
  let x = balance;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + balance / x) / 2n;
  }
  return x === 0n ? 1n : x;
}

export class TreasuryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/**
 * Create a proposal. Atomically: validates author, debits 1000 PLS from
 * the author's wallet, inserts the proposal row, logs the transaction.
 */
export async function createProposal(
  authorId: string,
  title: string,
  description: string,
) {
  if (!(await isTreasuryEnabled())) {
    throw new TreasuryError('DISABLED', 'Treasury is disabled');
  }
  const t = title.trim();
  const d = description.trim();
  if (t.length < TITLE_MIN || t.length > TITLE_MAX) {
    throw new TreasuryError('TITLE_LENGTH', `Title must be ${TITLE_MIN}-${TITLE_MAX} chars`);
  }
  if (d.length < DESCRIPTION_MIN || d.length > DESCRIPTION_MAX) {
    throw new TreasuryError(
      'DESCRIPTION_LENGTH',
      `Description must be ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} chars`,
    );
  }

  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { verificationLevel: true,
        role: true, isBot: true },
  });
  if (!author || author.isBot) throw new TreasuryError('FORBIDDEN', 'Not allowed');
  if (author.verificationLevel < MIN_VERIFICATION_LEVEL) {
    throw new TreasuryError('NOT_VERIFIED', 'Verification Level 1+ required');
  }

  const wallet = await prisma.plsWallet.findUnique({ where: { userId: authorId } });
  if (!wallet) throw new TreasuryError('NO_WALLET', 'Wallet not found');
  if (wallet.balance < PROPOSAL_DEPOSIT + MIN_BALANCE_TO_CREATE) {
    throw new TreasuryError('INSUFFICIENT_FUNDS', 'Need 1100 PLS (1000 deposit + 100 reserve)');
  }

  const endsAt = new Date(Date.now() + VOTING_PERIOD_DAYS * 24 * 3600 * 1000);

  const [proposal] = await prisma.$transaction([
    prisma.proposal.create({
      data: {
        authorId,
        title: t,
        description: d,
        deposit: PROPOSAL_DEPOSIT,
        endsAt,
      },
    }),
    prisma.plsWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: PROPOSAL_DEPOSIT } },
    }),
    prisma.plsTransaction.create({
      data: {
        walletId: wallet.id,
        amount: -PROPOSAL_DEPOSIT,
        type: 'TRANSFER',
        description: `Proposal deposit`,
      },
    }),
  ]);

  return proposal;
}

/**
 * Cast a vote. Idempotent at most ONE vote per user per proposal: trying
 * to vote again throws ALREADY_VOTED (changing your mind is intentionally
 * not allowed — keeps quadratic weights stable across the voting window).
 */
export async function castVote(
  proposalId: string,
  userId: string,
  choice: 'yes' | 'no',
) {
  if (!(await isTreasuryEnabled())) {
    throw new TreasuryError('DISABLED', 'Treasury is disabled');
  }
  if (choice !== 'yes' && choice !== 'no') {
    throw new TreasuryError('BAD_CHOICE', 'Choice must be yes or no');
  }

  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw new TreasuryError('NOT_FOUND', 'Proposal not found');
  if (proposal.status !== 'ACTIVE') throw new TreasuryError('CLOSED', 'Voting closed');
  if (proposal.endsAt < new Date()) throw new TreasuryError('CLOSED', 'Voting closed');
  if (proposal.authorId === userId) {
    throw new TreasuryError('SELF_VOTE', 'Authors cannot vote on their own proposal');
  }

  const existing = await prisma.proposalVote.findUnique({
    where: { proposalId_userId: { proposalId, userId } },
  });
  if (existing) throw new TreasuryError('ALREADY_VOTED', 'You already voted');

  const wallet = await prisma.plsWallet.findUnique({ where: { userId } });
  if (!wallet) throw new TreasuryError('NO_WALLET', 'Wallet not found');
  if (wallet.balance < MIN_BALANCE_TO_CREATE) {
    throw new TreasuryError('INSUFFICIENT_FUNDS', 'Need 100 PLS to vote');
  }

  const power = quadraticPower(wallet.balance);
  if (power <= 0n) throw new TreasuryError('NO_POWER', 'No voting power');

  await prisma.$transaction([
    prisma.proposalVote.create({
      data: { proposalId, userId, choice, votingPower: power },
    }),
    prisma.proposal.update({
      where: { id: proposalId },
      data: {
        voterCount: { increment: 1 },
        ...(choice === 'yes'
          ? { yesPower: { increment: power } }
          : { noPower: { increment: power } }),
      },
    }),
    prisma.plsWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: VOTE_REWARD } },
    }),
    prisma.plsTransaction.create({
      data: {
        walletId: wallet.id,
        amount: VOTE_REWARD,
        type: 'REWARD',
        description: `Vote reward`,
      },
    }),
  ]);

  return { power: power.toString(), reward: VOTE_REWARD.toString() };
}

/**
 * Close one expired proposal. Called by the worker for each row whose
 * endsAt passed and status is still ACTIVE. Three outcomes:
 *   - voterCount < QUORUM_VOTES → NO_QUORUM, deposit BURNED (anti-spam)
 *   - yesPower > noPower        → PASSED, deposit returned
 *   - else                      → FAILED, deposit returned
 */
export async function finalizeProposal(proposalId: string) {
  const p = await prisma.proposal.findUnique({ where: { id: proposalId } });
  if (!p || p.status !== 'ACTIVE') return null;

  let outcome: 'PASSED' | 'FAILED' | 'NO_QUORUM';
  let returnDeposit = false;
  if (p.voterCount < QUORUM_VOTES) {
    outcome = 'NO_QUORUM';
  } else if (p.yesPower > p.noPower) {
    outcome = 'PASSED';
    returnDeposit = true;
  } else {
    outcome = 'FAILED';
    returnDeposit = true;
  }

  const ops: any[] = [
    prisma.proposal.update({
      where: { id: proposalId },
      data: { status: outcome, resolvedAt: new Date() },
    }),
  ];

  if (returnDeposit) {
    const wallet = await prisma.plsWallet.findUnique({ where: { userId: p.authorId } });
    if (wallet) {
      ops.push(
        prisma.plsWallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: p.deposit } },
        }),
        prisma.plsTransaction.create({
          data: {
            walletId: wallet.id,
            amount: p.deposit,
            type: 'TRANSFER',
            description: `Proposal deposit refund`,
          },
        }),
      );
    }
  }

  await prisma.$transaction(ops);
  return { outcome, returned: returnDeposit, authorId: p.authorId, title: p.title };
}

export async function findExpiredProposalIds(): Promise<string[]> {
  const rows = await prisma.proposal.findMany({
    where: { status: 'ACTIVE', endsAt: { lt: new Date() } },
    select: { id: true },
    take: 50,
  });
  return rows.map((r) => r.id);
}
