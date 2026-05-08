import type { Prisma } from '@prisma/client';
import { PlsTransactionType } from '@prisma/client';
import { prisma } from '../../config/database.js';

/**
 * Records a permanent PLS supply removal in the transaction ledger.
 * The amount is attributed to the source user's wallet (so we can show
 * "X PLS burned by you" in the future), but the value just vanishes —
 * no recipient wallet is credited.
 *
 * Pulsar already burns implicitly in several places (P2P fees, merchant
 * subscription fees, application fees) by debiting the source without
 * crediting anyone. This helper makes those burns visible and queryable
 * so we can publish a transparent "X PLS burned to date" counter.
 *
 * Returns true on success, false if the source has no wallet.
 */
export async function recordBurn(
  tx: Prisma.TransactionClient,
  sourceUserId: string,
  amount: bigint,
  reason: string,
): Promise<boolean> {
  if (amount <= 0n) return false;
  const wallet = await tx.plsWallet.findUnique({
    where: { userId: sourceUserId },
    select: { id: true },
  });
  if (!wallet) return false;
  await tx.plsTransaction.create({
    data: {
      walletId: wallet.id,
      type: PlsTransactionType.BURN,
      // Negative — burns flow OUT of the system.
      amount: -amount,
      description: reason.slice(0, 256),
    },
  });
  return true;
}

/** Sum of all burned PLS to date. Used by the public economy stats endpoint. */
export async function totalBurned(): Promise<bigint> {
  const agg = await prisma.plsTransaction.aggregate({
    where: { type: PlsTransactionType.BURN },
    _sum: { amount: true },
  });
  // amounts are negative — flip sign for the user-facing total.
  return (agg._sum.amount ?? 0n) * -1n;
}

/** Total PLS currently in active wallets. Excludes burns + lock state. */
export async function circulatingSupply(): Promise<bigint> {
  const agg = await prisma.plsWallet.aggregate({
    _sum: { balance: true },
  });
  return agg._sum.balance ?? 0n;
}
