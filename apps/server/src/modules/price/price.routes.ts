import type { FastifyInstance } from 'fastify';
import { redis } from '../../config/redis.js';

/**
 * GET /api/v1/price — current PLS rate + FX rates for the supported
 * display currencies. Public endpoint (no auth) so the login page can
 * read it before sign-in.
 *
 * Source today: PLS isn't on a DEX yet, so we publish a fixed
 * "presale" rate set via env (PLS_USD_RATE). When the token launches
 * on a DEX, swap this for a Jupiter/Birdeye fetch — clients keep
 * working without changes.
 *
 * FX (USD → RUB/EUR/UAH) is fetched from open.er-api.com (no key
 * needed) and cached in Redis for 1h. Total upstream traffic under
 * 24 calls/day across the whole platform.
 */

const PLS_USD = Number(process.env.PLS_USD_RATE ?? '0.001');
const FX_TTL_SEC = 60 * 60;
const FX_CACHE_KEY = 'price:fx:usd';
const PLS_CACHE_KEY = 'price:pls:snapshot';
const PLS_TTL_SEC = 60;

interface FxRates {
  RUB: number;
  EUR: number;
  UAH: number;
  KZT: number;
  BYN: number;
}

const FX_FALLBACK: FxRates = {
  RUB: 90,
  EUR: 0.92,
  UAH: 41,
  KZT: 470,
  BYN: 3.2,
};

async function getFxRates(): Promise<FxRates> {
  const cached = await redis.get(FX_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached) as FxRates; } catch { /* fallthrough */ }
  }

  try {
    // 5s timeout via AbortController so a stalled FX upstream can't
    // hang client requests (route falls back to static rates).
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5_000);
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ac.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`fx upstream ${res.status}`);
    const data = await res.json() as { rates: Record<string, number> };
    const rates: FxRates = {
      RUB: Number(data.rates.RUB ?? FX_FALLBACK.RUB),
      EUR: Number(data.rates.EUR ?? FX_FALLBACK.EUR),
      UAH: Number(data.rates.UAH ?? FX_FALLBACK.UAH),
      KZT: Number(data.rates.KZT ?? FX_FALLBACK.KZT),
      BYN: Number(data.rates.BYN ?? FX_FALLBACK.BYN),
    };
    await redis.set(FX_CACHE_KEY, JSON.stringify(rates), 'EX', FX_TTL_SEC);
    return rates;
  } catch (err) {
    console.warn('[price] FX fetch failed, using fallback:', err);
    return FX_FALLBACK;
  }
}

export async function priceRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const cached = await redis.get(PLS_CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fallthrough */ }
    }

    const fx = await getFxRates();
    const snapshot = {
      // PLS price quoted in USD. When PLS lists on a DEX, replace the
      // env-driven constant with a Jupiter/Birdeye fetch.
      pls: {
        usd: PLS_USD,
        change24h: 0,        // no historical data while pre-DEX
        source: 'presale' as const,
      },
      fx: {
        USD: 1,
        RUB: fx.RUB,
        EUR: fx.EUR,
        UAH: fx.UAH,
        KZT: fx.KZT,
        BYN: fx.BYN,
      },
      updatedAt: new Date().toISOString(),
    };
    await redis.set(PLS_CACHE_KEY, JSON.stringify(snapshot), 'EX', PLS_TTL_SEC);
    return snapshot;
  });
}
