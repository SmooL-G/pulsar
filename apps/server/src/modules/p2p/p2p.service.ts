import { prisma } from '../../config/database.js';
import { Prisma, P2POfferStatus, P2PTradeStatus, PlsTransactionType } from '@prisma/client';

/**
 * Internal P2P PLS marketplace.
 *
 * Flow:
 *   1. Seller posts offer → totalAmount PLS moves from balance to lockedAmount
 *   2. Buyer opens trade → trade record created (PLS still locked)
 *   3. Buyer pays off-platform (СБП / USDT / etc), marks paid in app
 *   4. Seller confirms received, calls release → PLS moves from seller's
 *      lockedAmount to buyer's balance (1% platform fee deducted from
 *      seller's share)
 *
 * Disputes are resolved manually by an admin via forceRelease /
 * forceCancel until a community-arbitration system is built.
 */

const TRADE_TTL_MIN = 30;
const PLATFORM_FEE_BPS = 100n; // 1.00%

export class P2PError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'P2PError';
  }
}

interface CreateOfferArgs {
  sellerId: string;
  pricePerPlsUsd: number;
  totalAmount: bigint;
  minTrade?: bigint;
  maxTrade?: bigint;
  terms: string;
}

export async function createOffer(args: CreateOfferArgs) {
  if (args.pricePerPlsUsd <= 0) throw new P2PError('INVALID_PRICE', 'Price must be positive');
  if (args.totalAmount <= 0n) throw new P2PError('INVALID_AMOUNT', 'Amount must be positive');
  if (args.terms.length < 5) throw new P2PError('TERMS_REQUIRED', 'Describe payment instructions');
  if (args.maxTrade && args.maxTrade > args.totalAmount) {
    throw new P2PError('MAX_TOO_HIGH', 'Per-trade max cannot exceed total amount');
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.plsWallet.findUnique({ where: { userId: args.sellerId } });
    if (!wallet) throw new P2PError('NO_WALLET', 'Seller has no PLS wallet');
    const spendable = wallet.balance - wallet.lockedAmount;
    if (spendable < args.totalAmount) {
      throw new P2PError('INSUFFICIENT_BALANCE', `Need ${args.totalAmount} PLS, have ${spendable} spendable`);
    }

    await tx.plsWallet.update({
      where: { userId: args.sellerId },
      data: { lockedAmount: { increment: args.totalAmount } },
    });

    const offer = await tx.p2POffer.create({
      data: {
        sellerId: args.sellerId,
        pricePerPlsUsd: new Prisma.Decimal(args.pricePerPlsUsd),
        totalAmount: args.totalAmount,
        remainingAmount: args.totalAmount,
        minTrade: args.minTrade ?? 0n,
        maxTrade: args.maxTrade ?? 0n,
        terms: args.terms,
      },
    });
    return offer;
  });
}

/** Cancel an offer with no open trades against it. Returns locked PLS. */
export async function cancelOffer(offerId: string, sellerId: string) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.p2POffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.sellerId !== sellerId) throw new P2PError('NOT_FOUND', 'Offer not found');
    if (offer.status === P2POfferStatus.CANCELLED || offer.status === P2POfferStatus.COMPLETED) {
      throw new P2PError('FINAL_STATE', 'Offer is already finished');
    }
    const openTrades = await tx.p2PTrade.count({
      where: {
        offerId,
        status: { in: [P2PTradeStatus.PENDING_PAYMENT, P2PTradeStatus.PAID, P2PTradeStatus.DISPUTED] },
      },
    });
    if (openTrades > 0) {
      throw new P2PError('TRADES_OPEN', 'Cannot cancel — open trades exist');
    }
    await tx.p2POffer.update({
      where: { id: offerId },
      data: { status: P2POfferStatus.CANCELLED, remainingAmount: 0n },
    });
    if (offer.remainingAmount > 0n) {
      await tx.plsWallet.update({
        where: { userId: sellerId },
        data: { lockedAmount: { decrement: offer.remainingAmount } },
      });
    }
    return { success: true };
  });
}

interface OpenTradeArgs {
  offerId: string;
  buyerId: string;
  amount: bigint;
}

export async function openTrade(args: OpenTradeArgs) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.p2POffer.findUnique({ where: { id: args.offerId } });
    if (!offer) throw new P2PError('NOT_FOUND', 'Offer not found');
    if (offer.status !== P2POfferStatus.ACTIVE) throw new P2PError('NOT_ACTIVE', 'Offer is not active');
    if (offer.sellerId === args.buyerId) throw new P2PError('SELF_TRADE', "Can't trade with yourself");
    if (args.amount <= 0n) throw new P2PError('INVALID_AMOUNT', 'Amount must be positive');
    if (args.amount > offer.remainingAmount) {
      throw new P2PError('INSUFFICIENT_OFFER', `Only ${offer.remainingAmount} PLS available`);
    }
    if (offer.minTrade > 0n && args.amount < offer.minTrade) {
      throw new P2PError('BELOW_MIN', `Minimum is ${offer.minTrade} PLS`);
    }
    if (offer.maxTrade > 0n && args.amount > offer.maxTrade) {
      throw new P2PError('ABOVE_MAX', `Maximum is ${offer.maxTrade} PLS`);
    }

    // Block opening another trade against the same offer for the same
    // buyer if one is still pending — a single buyer with multiple
    // pending trades can starve the offer's escrow.
    const existing = await tx.p2PTrade.findFirst({
      where: {
        offerId: args.offerId,
        buyerId: args.buyerId,
        status: { in: [P2PTradeStatus.PENDING_PAYMENT, P2PTradeStatus.PAID] },
      },
    });
    if (existing) throw new P2PError('ALREADY_OPEN', 'You already have an open trade for this offer');

    const totalPriceUsd = new Prisma.Decimal(args.amount.toString()).mul(offer.pricePerPlsUsd);
    const expiresAt = new Date(Date.now() + TRADE_TTL_MIN * 60 * 1000);

    const trade = await tx.p2PTrade.create({
      data: {
        offerId: args.offerId,
        buyerId: args.buyerId,
        sellerId: offer.sellerId,
        amount: args.amount,
        totalPriceUsd,
        expiresAt,
      },
    });

    await tx.p2POffer.update({
      where: { id: args.offerId },
      data: { remainingAmount: { decrement: args.amount } },
    });
    return trade;
  });
}

/** Buyer marks fiat payment as sent. Optional note: txid, screenshot ref, etc. */
export async function markPaid(tradeId: string, buyerId: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const trade = await tx.p2PTrade.findUnique({ where: { id: tradeId } });
    if (!trade || trade.buyerId !== buyerId) throw new P2PError('NOT_FOUND', 'Trade not found');
    if (trade.status !== P2PTradeStatus.PENDING_PAYMENT) {
      throw new P2PError('BAD_STATE', `Cannot mark paid in ${trade.status}`);
    }
    return tx.p2PTrade.update({
      where: { id: tradeId },
      data: {
        status: P2PTradeStatus.PAID,
        paidAt: new Date(),
        paymentNote: note?.slice(0, 500) ?? null,
        // Buyer marked paid → drop the auto-cancel deadline by pushing
        // expiresAt far into the future so the worker doesn't void it.
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  });
}

/**
 * Seller releases PLS to buyer. Moves seller's lockedAmount to buyer's
 * balance. Platform fee (1%) is deducted from the released amount.
 */
export async function releaseTrade(tradeId: string, sellerId: string) {
  return prisma.$transaction(async (tx) => {
    const trade = await tx.p2PTrade.findUnique({ where: { id: tradeId } });
    if (!trade || trade.sellerId !== sellerId) throw new P2PError('NOT_FOUND', 'Trade not found');
    if (trade.status !== P2PTradeStatus.PAID) {
      throw new P2PError('BAD_STATE', 'Can only release after buyer marks paid');
    }

    const fee = (trade.amount * PLATFORM_FEE_BPS) / 10_000n;
    const buyerReceives = trade.amount - fee;

    // Deduct from seller's balance + lock; credit buyer's balance.
    await tx.plsWallet.update({
      where: { userId: sellerId },
      data: {
        balance: { decrement: trade.amount },
        lockedAmount: { decrement: trade.amount },
      },
    });
    // Buyer wallet may not exist yet — upsert.
    await tx.plsWallet.upsert({
      where: { userId: trade.buyerId },
      create: { userId: trade.buyerId, balance: buyerReceives },
      update: { balance: { increment: buyerReceives } },
    });

    // Transaction log entries (best-effort, link to the seller's wallet
    // for the debit, buyer's wallet for the credit).
    const sellerWallet = await tx.plsWallet.findUnique({ where: { userId: sellerId } });
    const buyerWallet = await tx.plsWallet.findUnique({ where: { userId: trade.buyerId } });
    if (sellerWallet) {
      await tx.plsTransaction.create({
        data: {
          walletId: sellerWallet.id,
          type: PlsTransactionType.TRANSFER,
          amount: -trade.amount,
          description: `P2P sale ${tradeId.slice(0, 8)} (fee ${fee})`,
        },
      });
    }
    if (buyerWallet) {
      await tx.plsTransaction.create({
        data: {
          walletId: buyerWallet.id,
          type: PlsTransactionType.TRANSFER,
          amount: buyerReceives,
          description: `P2P purchase ${tradeId.slice(0, 8)}`,
        },
      });
    }

    const released = await tx.p2PTrade.update({
      where: { id: tradeId },
      data: { status: P2PTradeStatus.RELEASED, releasedAt: new Date() },
    });

    // If offer's remainingAmount is now 0 and no other trades pending →
    // mark COMPLETED.
    const offer = await tx.p2POffer.findUnique({ where: { id: trade.offerId } });
    if (offer && offer.remainingAmount === 0n) {
      const stillOpen = await tx.p2PTrade.count({
        where: {
          offerId: offer.id,
          status: { in: [P2PTradeStatus.PENDING_PAYMENT, P2PTradeStatus.PAID, P2PTradeStatus.DISPUTED] },
        },
      });
      if (stillOpen === 0) {
        await tx.p2POffer.update({ where: { id: offer.id }, data: { status: P2POfferStatus.COMPLETED } });
      }
    }
    return { ...released, fee };
  });
}

/**
 * Either party cancels a PENDING_PAYMENT trade (e.g., changed mind).
 * Returns reserved PLS to the offer's remainingAmount so a new buyer
 * can pick it up.
 */
export async function cancelTrade(tradeId: string, userId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const trade = await tx.p2PTrade.findUnique({ where: { id: tradeId } });
    if (!trade) throw new P2PError('NOT_FOUND', 'Trade not found');
    if (trade.buyerId !== userId && trade.sellerId !== userId) {
      throw new P2PError('FORBIDDEN', 'Not your trade');
    }
    if (trade.status !== P2PTradeStatus.PENDING_PAYMENT) {
      throw new P2PError('BAD_STATE', 'Can only cancel before payment');
    }
    await tx.p2POffer.update({
      where: { id: trade.offerId },
      data: { remainingAmount: { increment: trade.amount } },
    });
    return tx.p2PTrade.update({
      where: { id: tradeId },
      data: {
        status: P2PTradeStatus.CANCELLED,
        cancelledAt: new Date(),
        paymentNote: reason?.slice(0, 500) ?? null,
      },
    });
  });
}

/** Open a dispute on a PAID trade. Admin will resolve. */
export async function openDispute(tradeId: string, userId: string, reason: string) {
  const trade = await prisma.p2PTrade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new P2PError('NOT_FOUND', 'Trade not found');
  if (trade.buyerId !== userId && trade.sellerId !== userId) {
    throw new P2PError('FORBIDDEN', 'Not your trade');
  }
  if (trade.status !== P2PTradeStatus.PAID) {
    throw new P2PError('BAD_STATE', 'Disputes only on trades that buyer marked paid');
  }
  return prisma.p2PTrade.update({
    where: { id: tradeId },
    data: {
      status: P2PTradeStatus.DISPUTED,
      paymentNote: `[DISPUTE] ${reason.slice(0, 480)}`,
    },
  });
}
