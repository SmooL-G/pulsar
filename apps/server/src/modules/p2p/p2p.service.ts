import { prisma } from '../../config/database.js';
import { Prisma, P2POfferSide, P2POfferStatus, P2PTradeStatus, PlsTransactionType, MerchantTier } from '@prisma/client';
import { recordBurn } from '../economy/burn.service.js';

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
// Default platform fee = 1%. OFFICIAL merchants pay 0.5% as a perk
// of their paid subscription — see release path below.
const PLATFORM_FEE_BPS = 100n;            // 1.00%
const PLATFORM_FEE_BPS_OFFICIAL = 50n;    // 0.50%

/**
 * Minimum verification level to use the P2P marketplace.
 * L2 means the user passed at least one identity-anchor step (e.g.
 * staked PLS, email-verified account ≥ 30 days old, etc) — meaningfully
 * harder to sybil-spam than fresh L0/L1 accounts. Cuts the worst class
 * of "throwaway scammer" listings without locking out real users.
 */
const MIN_VERIFICATION_LEVEL = 2;

export class P2PError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'P2PError';
  }
}

async function assertEligible(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verificationLevel: true },
  });
  if (!user) throw new P2PError('NOT_FOUND', 'User not found');
  if ((user.verificationLevel ?? 0) < MIN_VERIFICATION_LEVEL) {
    throw new P2PError(
      'VERIFICATION_REQUIRED',
      `P2P marketplace requires verification level ${MIN_VERIFICATION_LEVEL}+`,
    );
  }
}

export const P2P_MIN_VERIFICATION_LEVEL = MIN_VERIFICATION_LEVEL;

interface CreateOfferArgs {
  creatorId: string;
  side: P2POfferSide;
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
  await assertEligible(args.creatorId);

  return prisma.$transaction(async (tx) => {
    // Only SELL offers escrow PLS at creation. For BUY offers the
    // creator is the buyer — they have no PLS to lock; the responding
    // seller's PLS gets escrowed when the trade opens.
    if (args.side === P2POfferSide.SELL) {
      const wallet = await tx.plsWallet.findUnique({ where: { userId: args.creatorId } });
      if (!wallet) throw new P2PError('NO_WALLET', 'No PLS wallet');
      const spendable = wallet.balance - wallet.lockedAmount;
      if (spendable < args.totalAmount) {
        throw new P2PError('INSUFFICIENT_BALANCE', `Need ${args.totalAmount} PLS, have ${spendable} spendable`);
      }
      await tx.plsWallet.update({
        where: { userId: args.creatorId },
        data: { lockedAmount: { increment: args.totalAmount } },
      });
    }

    const offer = await tx.p2POffer.create({
      data: {
        sellerId: args.creatorId,    // column re-used as creator id
        side: args.side,
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
export async function cancelOffer(offerId: string, creatorId: string) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.p2POffer.findUnique({ where: { id: offerId } });
    if (!offer || offer.sellerId !== creatorId) throw new P2PError('NOT_FOUND', 'Offer not found');
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
    // Only SELL offers had PLS locked at creation — return it.
    if (offer.side === P2POfferSide.SELL && offer.remainingAmount > 0n) {
      await tx.plsWallet.update({
        where: { userId: creatorId },
        data: { lockedAmount: { decrement: offer.remainingAmount } },
      });
    }
    return { success: true };
  });
}

interface OpenTradeArgs {
  offerId: string;
  responderId: string;   // user opening the trade against the offer
  amount: bigint;
}

export async function openTrade(args: OpenTradeArgs) {
  await assertEligible(args.responderId);
  return prisma.$transaction(async (tx) => {
    const offer = await tx.p2POffer.findUnique({ where: { id: args.offerId } });
    if (!offer) throw new P2PError('NOT_FOUND', 'Offer not found');
    if (offer.status !== P2POfferStatus.ACTIVE) throw new P2PError('NOT_ACTIVE', 'Offer is not active');
    if (offer.sellerId === args.responderId) throw new P2PError('SELF_TRADE', "Can't trade with yourself");
    // Fake-activity intercept: fake-seeded offers must never reach the
    // PLS lock or trade-row insert. The error code is deliberately
    // ambiguous (looks like a real concurrency event) to avoid
    // exposing the seed.
    const seller = await tx.user.findUnique({
      where: { id: offer.sellerId },
      select: { isFake: true },
    });
    if (seller?.isFake) {
      throw new P2PError(
        'MERCHANT_BUSY',
        'У этого мерчанта уже идёт сделка. Попробуйте позже или выберите другое предложение.',
      );
    }
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

    // Determine buyer/seller from offer side + who's responding.
    // SELL offer: responder is buyer; creator is seller (PLS already locked at creation).
    // BUY offer: responder is seller; creator is buyer; lock seller's PLS now.
    const buyerId = offer.side === P2POfferSide.SELL ? args.responderId : offer.sellerId;
    const sellerId = offer.side === P2POfferSide.SELL ? offer.sellerId : args.responderId;

    // For BUY offers, check + lock the responder seller's PLS now.
    if (offer.side === P2POfferSide.BUY) {
      const wallet = await tx.plsWallet.findUnique({ where: { userId: sellerId } });
      if (!wallet) throw new P2PError('NO_WALLET', "You don't have a PLS wallet");
      const spendable = wallet.balance - wallet.lockedAmount;
      if (spendable < args.amount) {
        throw new P2PError('INSUFFICIENT_BALANCE', `Need ${args.amount} PLS, have ${spendable} spendable`);
      }
      await tx.plsWallet.update({
        where: { userId: sellerId },
        data: { lockedAmount: { increment: args.amount } },
      });
    }

    // Block opening another trade against the same offer for the same
    // responder if one is still pending.
    const existing = await tx.p2PTrade.findFirst({
      where: {
        offerId: args.offerId,
        OR: [{ buyerId: args.responderId }, { sellerId: args.responderId }],
        status: { in: [P2PTradeStatus.PENDING_PAYMENT, P2PTradeStatus.PAID] },
      },
    });
    if (existing) throw new P2PError('ALREADY_OPEN', 'You already have an open trade for this offer');

    const totalPriceUsd = new Prisma.Decimal(args.amount.toString()).mul(offer.pricePerPlsUsd);
    const expiresAt = new Date(Date.now() + TRADE_TTL_MIN * 60 * 1000);

    const trade = await tx.p2PTrade.create({
      data: {
        offerId: args.offerId,
        buyerId,
        sellerId,
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

    // OFFICIAL merchants get the discounted fee on PLS they sell.
    const seller = await tx.user.findUnique({
      where: { id: sellerId },
      select: { merchantTier: true, merchantExpiresAt: true },
    });
    const isOfficial = seller?.merchantTier === MerchantTier.OFFICIAL
      && (!seller.merchantExpiresAt || seller.merchantExpiresAt > new Date());
    const feeBps = isOfficial ? PLATFORM_FEE_BPS_OFFICIAL : PLATFORM_FEE_BPS;
    const fee = (trade.amount * feeBps) / 10_000n;
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
    // The fee is implicitly removed (seller debited full amount, buyer
    // credited amount-fee). Record it explicitly so the public economy
    // stats endpoint can show "X PLS burned to date".
    if (fee > 0n) {
      await recordBurn(tx, sellerId, fee, `P2P platform fee burn ${tradeId.slice(0, 8)}`);
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
 * can pick it up. For BUY offers, also unlocks the seller's wallet
 * (lock was placed at trade open, not offer creation).
 */
export async function cancelTrade(tradeId: string, userId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const trade = await tx.p2PTrade.findUnique({
      where: { id: tradeId },
      include: { offer: { select: { side: true } } },
    });
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
    if (trade.offer.side === P2POfferSide.BUY) {
      // Unlock seller's PLS that was reserved at trade open.
      await tx.plsWallet.update({
        where: { userId: trade.sellerId },
        data: { lockedAmount: { decrement: trade.amount } },
      });
    }
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

/** Send a chat message inside an active trade. Buyer or seller only. */
export async function sendTradeMessage(tradeId: string, senderId: string, content: string) {
  const text = content.trim();
  if (text.length === 0) throw new P2PError('EMPTY', 'Message is empty');
  if (text.length > 2000) throw new P2PError('TOO_LONG', 'Message exceeds 2000 chars');
  const trade = await prisma.p2PTrade.findUnique({
    where: { id: tradeId },
    select: { buyerId: true, sellerId: true, status: true },
  });
  if (!trade) throw new P2PError('NOT_FOUND', 'Trade not found');
  if (trade.buyerId !== senderId && trade.sellerId !== senderId) {
    throw new P2PError('FORBIDDEN', 'Not your trade');
  }
  // Allow chat even on RELEASED / CANCELLED so disputes can still
  // gather context after the fact.
  return prisma.p2PTradeMessage.create({
    data: { tradeId, senderId, content: text.slice(0, 2000) },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
}

/** List trade messages for a participant or admin. Newest last. */
export async function listTradeMessages(tradeId: string, viewerId: string, isAdmin: boolean) {
  const trade = await prisma.p2PTrade.findUnique({
    where: { id: tradeId },
    select: { buyerId: true, sellerId: true },
  });
  if (!trade) throw new P2PError('NOT_FOUND', 'Trade not found');
  if (!isAdmin && trade.buyerId !== viewerId && trade.sellerId !== viewerId) {
    throw new P2PError('FORBIDDEN', 'Not your trade');
  }
  return prisma.p2PTradeMessage.findMany({
    where: { tradeId },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
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
