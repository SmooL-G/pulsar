import type { FastifyInstance } from 'fastify';
import { redis } from '../../config/redis.js';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { getEffectivePrice, setReferencePrice, getReferenceHistory } from './price.service.js';

/**
 * Public + admin price API.
 *
 * GET  /price            — public; effective price + FX rates (cached 60s)
 * GET  /price/admin      — SUPER_ADMIN only; current reference + history
 * POST /price/admin      — SUPER_ADMIN only; set new reference (appended)
 *
 * Effective price layers reference + market — see price.service.ts.
 */

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
  // GET /price/history?window=24h|7d|30d — returns sparkline points.
  // Public so the login page can show the chart before auth.
  app.get<{ Querystring: { window?: '24h' | '7d' | '30d' } }>('/history', async (request) => {
    const win = request.query.window === '7d' ? 7 : request.query.window === '30d' ? 30 : 1;
    const since = new Date(Date.now() - win * 24 * 60 * 60 * 1000);
    const rows = await prisma.plsPriceSnapshot.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, pricePerPlsUsd: true, source: true },
    });
    return {
      window: request.query.window ?? '24h',
      points: rows.map((r) => ({
        ts: r.createdAt.toISOString(),
        price: Number(r.pricePerPlsUsd),
        source: r.source,
      })),
    };
  });

  // Public — no auth.
  app.get('/', async () => {
    const cached = await redis.get(PLS_CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fallthrough */ }
    }
    const [fx, eff] = await Promise.all([getFxRates(), getEffectivePrice()]);
    const snapshot = {
      pls: {
        usd: eff.pricePerPlsUsd,
        change24h: 0,
        source: eff.source,
        reference: eff.reference,
        market: eff.market,
        clamped: eff.clamped,
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

  // Admin endpoints — SUPER_ADMIN only.
  app.register(async (admin) => {
    admin.addHook('preHandler', authMiddleware);
    admin.addHook('preHandler', async (request, reply) => {
      if (request.user?.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }
    });

    admin.get('/admin', async () => {
      const [eff, history] = await Promise.all([getEffectivePrice(), getReferenceHistory(20)]);
      return {
        effective: eff,
        history: history.map((h) => ({
          id: h.id,
          pricePerPlsUsd: Number(h.pricePerPlsUsd),
          setAt: h.setAt.toISOString(),
          notes: h.notes,
          setByUser: h.setByUser ? { username: h.setByUser.username, displayName: h.setByUser.displayName } : null,
        })),
      };
    });

    admin.post<{ Body: { pricePerPlsUsd: number; notes?: string } }>('/admin', async (request, reply) => {
      const { pricePerPlsUsd, notes } = request.body;
      if (!pricePerPlsUsd || !Number.isFinite(pricePerPlsUsd) || pricePerPlsUsd <= 0) {
        return reply.status(400).send({ error: 'INVALID_PRICE' });
      }
      const row = await setReferencePrice({
        pricePerPlsUsd,
        setBy: request.user!.userId,
        notes,
      });
      // Bust the public snapshot cache so the new value is visible
      // immediately, not after the 60s TTL.
      await redis.del(PLS_CACHE_KEY);
      return {
        success: true,
        reference: { id: row.id, pricePerPlsUsd: Number(row.pricePerPlsUsd), setAt: row.setAt.toISOString() },
      };
    });
  });
}
