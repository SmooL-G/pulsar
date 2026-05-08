import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import {
  cancelOffer,
  cancelTrade,
  createOffer,
  markPaid,
  openDispute,
  openTrade,
  releaseTrade,
  P2PError,
  P2P_MIN_VERIFICATION_LEVEL,
} from './p2p.service.js';
import { P2POfferSide, P2POfferStatus, P2PTradeStatus } from '@prisma/client';

function handle<T>(reply: any, fn: () => Promise<T>) {
  return fn().catch((err: any) => {
    if (err instanceof P2PError) return reply.status(400).send({ error: err.code, message: err.message });
    console.error('[p2p]', err);
    return reply.status(500).send({ error: 'INTERNAL', message: 'Server error' });
  });
}

const userPickFields = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  verificationLevel: true,
  merchantTier: true,
  merchantSince: true,
  isOnline: true,
} as const;

export async function p2pRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /p2p/eligibility — UI gate. Returns minLevel + whether the
  // current user qualifies. Cheap, no auth-side branching needed.
  app.get('/eligibility', async (request) => {
    const userId = request.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { verificationLevel: true },
    });
    const level = user?.verificationLevel ?? 0;
    return {
      minLevel: P2P_MIN_VERIFICATION_LEVEL,
      level,
      allowed: level >= P2P_MIN_VERIFICATION_LEVEL,
    };
  });

  // ─── OFFERS ───────────────────────────────────────────

  // GET /p2p/offers — list active offers (marketplace browse).
  // Sort: OFFICIAL first, then TRUSTED, then NONE, each by createdAt desc.
  app.get('/offers', async (request) => {
    const offers = await prisma.p2POffer.findMany({
      where: { status: P2POfferStatus.ACTIVE, remainingAmount: { gt: 0n } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { seller: { select: userPickFields } },
    });
    const tierRank: Record<string, number> = { OFFICIAL: 0, TRUSTED: 1, NONE: 2 };
    offers.sort((a, b) => {
      const ra = tierRank[a.seller.merchantTier ?? 'NONE'] ?? 2;
      const rb = tierRank[b.seller.merchantTier ?? 'NONE'] ?? 2;
      if (ra !== rb) return ra - rb;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return {
      offers: offers.map((o) => ({
        id: o.id,
        creator: o.seller,                    // for SELL = seller, for BUY = buyer
        side: o.side,
        pricePerPlsUsd: Number(o.pricePerPlsUsd),
        totalAmount: o.totalAmount.toString(),
        remainingAmount: o.remainingAmount.toString(),
        minTrade: o.minTrade.toString(),
        maxTrade: o.maxTrade.toString(),
        terms: o.terms,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  });

  // GET /p2p/offers/mine — current user's own offers
  app.get('/offers/mine', async (request) => {
    const userId = request.user!.userId;
    const offers = await prisma.p2POffer.findMany({
      where: { sellerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      offers: offers.map((o) => ({
        id: o.id,
        side: o.side,
        pricePerPlsUsd: Number(o.pricePerPlsUsd),
        totalAmount: o.totalAmount.toString(),
        remainingAmount: o.remainingAmount.toString(),
        minTrade: o.minTrade.toString(),
        maxTrade: o.maxTrade.toString(),
        terms: o.terms,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
    };
  });

  // POST /p2p/offers — create new offer
  app.post<{
    Body: {
      side?: 'SELL' | 'BUY';
      pricePerPlsUsd: number;
      totalAmount: string | number;
      minTrade?: string | number;
      maxTrade?: string | number;
      terms: string;
    };
  }>('/offers', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      const side = request.body.side === 'BUY' ? P2POfferSide.BUY : P2POfferSide.SELL;
      const offer = await createOffer({
        creatorId: userId,
        side,
        pricePerPlsUsd: Number(request.body.pricePerPlsUsd),
        totalAmount: BigInt(request.body.totalAmount),
        minTrade: request.body.minTrade ? BigInt(request.body.minTrade) : 0n,
        maxTrade: request.body.maxTrade ? BigInt(request.body.maxTrade) : 0n,
        terms: request.body.terms ?? '',
      });
      return reply.status(201).send({
        offer: {
          id: offer.id,
          side: offer.side,
          status: offer.status,
          remainingAmount: offer.remainingAmount.toString(),
        },
      });
    }),
  );

  // DELETE /p2p/offers/:id — cancel own offer (no open trades)
  app.delete<{ Params: { id: string } }>('/offers/:id', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      const result = await cancelOffer(request.params.id, userId);
      return result;
    }),
  );

  // ─── TRADES ───────────────────────────────────────────

  // POST /p2p/offers/:id/trades — open a trade against an offer.
  // For SELL offers the responder becomes buyer; for BUY offers the
  // responder becomes seller (and their PLS is escrowed).
  app.post<{
    Params: { id: string };
    Body: { amount: string | number };
  }>('/offers/:id/trades', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      const trade = await openTrade({
        offerId: request.params.id,
        responderId: userId,
        amount: BigInt(request.body.amount),
      });
      return reply.status(201).send({
        trade: {
          id: trade.id,
          status: trade.status,
          amount: trade.amount.toString(),
          totalPriceUsd: Number(trade.totalPriceUsd),
          expiresAt: trade.expiresAt.toISOString(),
        },
      });
    }),
  );

  // GET /p2p/trades/mine — user's own trades (as buyer or seller)
  app.get('/trades/mine', async (request) => {
    const userId = request.user!.userId;
    const trades = await prisma.p2PTrade.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        buyer: { select: userPickFields },
        seller: { select: userPickFields },
        offer: { select: { id: true, terms: true, pricePerPlsUsd: true } },
      },
    });
    return {
      trades: trades.map((t) => ({
        id: t.id,
        offerId: t.offerId,
        offerTerms: t.offer.terms,
        amount: t.amount.toString(),
        totalPriceUsd: Number(t.totalPriceUsd),
        status: t.status,
        paymentNote: t.paymentNote,
        paidAt: t.paidAt?.toISOString() ?? null,
        releasedAt: t.releasedAt?.toISOString() ?? null,
        cancelledAt: t.cancelledAt?.toISOString() ?? null,
        expiresAt: t.expiresAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
        buyer: t.buyer,
        seller: t.seller,
        myRole: t.buyerId === userId ? 'buyer' : 'seller',
      })),
    };
  });

  // GET /p2p/trades/:id — single trade (only if I'm a participant)
  app.get<{ Params: { id: string } }>('/trades/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const trade = await prisma.p2PTrade.findUnique({
      where: { id: request.params.id },
      include: {
        buyer: { select: userPickFields },
        seller: { select: userPickFields },
        offer: { select: { id: true, terms: true, pricePerPlsUsd: true } },
      },
    });
    if (!trade || (trade.buyerId !== userId && trade.sellerId !== userId)) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }
    return {
      trade: {
        id: trade.id,
        offerId: trade.offerId,
        offerTerms: trade.offer.terms,
        pricePerPlsUsd: Number(trade.offer.pricePerPlsUsd),
        amount: trade.amount.toString(),
        totalPriceUsd: Number(trade.totalPriceUsd),
        status: trade.status,
        paymentNote: trade.paymentNote,
        paidAt: trade.paidAt?.toISOString() ?? null,
        releasedAt: trade.releasedAt?.toISOString() ?? null,
        cancelledAt: trade.cancelledAt?.toISOString() ?? null,
        expiresAt: trade.expiresAt.toISOString(),
        createdAt: trade.createdAt.toISOString(),
        buyer: trade.buyer,
        seller: trade.seller,
        myRole: trade.buyerId === userId ? 'buyer' : 'seller',
      },
    };
  });

  app.post<{ Params: { id: string }; Body: { note?: string } }>('/trades/:id/paid', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      await markPaid(request.params.id, userId, request.body.note);
      return { success: true };
    }),
  );

  app.post<{ Params: { id: string } }>('/trades/:id/release', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      const result = await releaseTrade(request.params.id, userId);
      return { success: true, fee: result.fee.toString() };
    }),
  );

  app.post<{ Params: { id: string }; Body: { reason?: string } }>('/trades/:id/cancel', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      await cancelTrade(request.params.id, userId, request.body.reason);
      return { success: true };
    }),
  );

  app.post<{ Params: { id: string }; Body: { reason: string } }>('/trades/:id/dispute', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      await openDispute(request.params.id, userId, request.body.reason ?? '');
      return { success: true };
    }),
  );
}
