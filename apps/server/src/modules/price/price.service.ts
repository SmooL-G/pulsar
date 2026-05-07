import { prisma } from '../../config/database.js';
import { Prisma, P2PTradeStatus } from '@prisma/client';

/**
 * Hybrid PLS price source:
 *
 *   1. Reference price — admin-set anchor stored in PlsPriceReference.
 *      Fallback: env PLS_USD_RATE if no row exists yet.
 *
 *   2. Market price — volume-weighted average of P2P trades that
 *      released in the last 7d. Filters out wash-trading / spam:
 *        - amount must be ≥ MIN_TRADE_PLS
 *        - at most MAX_TRADES_PER_PAIR trades per (buyer,seller) pair
 *
 *   3. Effective price — when 7d volume ≥ MIN_VOLUME_FOR_MARKET, the
 *      market price wins (clamped to ±MARKET_BAND_PCT around reference
 *      so a kraken-and-shrimp duo can't 10x or /10x the visible price).
 *      Otherwise reference is published as-is.
 */

const MARKET_WINDOW_DAYS = 7;
const MIN_TRADE_PLS = 1_000n;            // ignore micro-trades
const MAX_TRADES_PER_PAIR = 5;           // cap per pair to dampen wash trading
const MIN_VOLUME_FOR_MARKET = 100_000n;  // 100k PLS released in window
const MARKET_BAND_PCT = 0.5;             // ±50% bound around reference

export interface EffectivePrice {
  pricePerPlsUsd: number;
  source: 'presale' | 'market';
  // Optional details surfaced to the UI for transparency.
  reference: number;
  market: { price: number; volumePls: string; trades: number } | null;
  clamped: boolean;
}

async function loadReference(): Promise<number> {
  const row = await prisma.plsPriceReference.findFirst({
    orderBy: { setAt: 'desc' },
    select: { pricePerPlsUsd: true },
  });
  if (row) return Number(row.pricePerPlsUsd);
  // Bootstrap fallback — env-configured presale value.
  return Number(process.env.PLS_USD_RATE ?? '0.001');
}

async function computeMarketPrice(): Promise<{ price: number; volumePls: bigint; trades: number } | null> {
  const since = new Date(Date.now() - MARKET_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const trades = await prisma.p2PTrade.findMany({
    where: {
      status: P2PTradeStatus.RELEASED,
      releasedAt: { gte: since },
      amount: { gte: MIN_TRADE_PLS },
    },
    select: {
      amount: true,
      totalPriceUsd: true,
      buyerId: true,
      sellerId: true,
      releasedAt: true,
    },
    orderBy: { releasedAt: 'asc' },
  });
  if (trades.length === 0) return null;

  // Cap trades per pair (anti wash-trading).
  const pairCount = new Map<string, number>();
  let weightedSumUsd = new Prisma.Decimal(0);
  let totalAmount = 0n;
  let counted = 0;

  for (const t of trades) {
    const a = t.buyerId < t.sellerId ? t.buyerId : t.sellerId;
    const b = t.buyerId < t.sellerId ? t.sellerId : t.buyerId;
    const pairKey = `${a}:${b}`;
    const cnt = pairCount.get(pairKey) ?? 0;
    if (cnt >= MAX_TRADES_PER_PAIR) continue;
    pairCount.set(pairKey, cnt + 1);

    weightedSumUsd = weightedSumUsd.add(t.totalPriceUsd);
    totalAmount += t.amount;
    counted++;
  }

  if (totalAmount === 0n) return null;
  const price = Number(weightedSumUsd) / Number(totalAmount);
  return { price, volumePls: totalAmount, trades: counted };
}

export async function getEffectivePrice(): Promise<EffectivePrice> {
  const [reference, market] = await Promise.all([loadReference(), computeMarketPrice()]);

  if (!market || market.volumePls < MIN_VOLUME_FOR_MARKET) {
    return {
      pricePerPlsUsd: reference,
      source: 'presale',
      reference,
      market: market
        ? { price: market.price, volumePls: market.volumePls.toString(), trades: market.trades }
        : null,
      clamped: false,
    };
  }

  // Clamp market within ±MARKET_BAND_PCT of reference.
  const lower = reference * (1 - MARKET_BAND_PCT);
  const upper = reference * (1 + MARKET_BAND_PCT);
  const clamped = Math.min(Math.max(market.price, lower), upper);

  return {
    pricePerPlsUsd: clamped,
    source: 'market',
    reference,
    market: { price: market.price, volumePls: market.volumePls.toString(), trades: market.trades },
    clamped: clamped !== market.price,
  };
}

/** Append a new admin-set reference row. Old rows are kept as audit log. */
export async function setReferencePrice(args: {
  pricePerPlsUsd: number;
  setBy: string;
  notes?: string;
}) {
  if (args.pricePerPlsUsd <= 0) throw new Error('Price must be positive');
  return prisma.plsPriceReference.create({
    data: {
      pricePerPlsUsd: new Prisma.Decimal(args.pricePerPlsUsd),
      setBy: args.setBy,
      notes: args.notes?.slice(0, 500) ?? null,
    },
  });
}

/** Recent reference history for the admin UI. */
export async function getReferenceHistory(limit = 20) {
  return prisma.plsPriceReference.findMany({
    orderBy: { setAt: 'desc' },
    take: limit,
    include: {
      setByUser: { select: { id: true, username: true, displayName: true } },
    },
  });
}
