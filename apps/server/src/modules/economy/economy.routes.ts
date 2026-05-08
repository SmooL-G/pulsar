import type { FastifyInstance } from 'fastify';
import { redis } from '../../config/redis.js';
import { totalBurned, circulatingSupply } from './burn.service.js';
import { TOTAL_SUPPLY } from '../staking/staking.service.js';
import {
  currentHalvingEra,
  getBaseRatePerHour,
  getMaxDailyPayout,
  getBandwidthBonusPerGB,
  getPeerBonusPerPeer,
  HALVING_ANCHOR_MS,
  HALVING_INTERVAL_DAYS,
} from '../nodes/nodes.service.js';
import { getTypingNow } from '../../socket/handlers/typingHandler.js';
import { prisma } from '../../config/database.js';

/**
 * Public read-only economy stats. Powers the "X PLS burned" widget on
 * the dashboard and any future tokenomics page. No auth required —
 * full transparency is the point.
 *
 * Cached in Redis for 60s so a viral moment with thousands of refreshes
 * doesn't pound aggregates.
 */

const CACHE_KEY = 'economy:stats';
const CACHE_TTL_SEC = 60;

export async function economyRoutes(app: FastifyInstance) {
  // GET /economy/pulse — public proof-of-life snapshot. "X людей сейчас
  // печатают, Y онлайн" — для виджета на login / dashboard. Кеш 5с,
  // чтобы вирусный момент не положил Redis.
  app.get('/pulse', async () => {
    const cached = await redis.get('economy:pulse');
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fallthrough */ }
    }
    const [typingNow, onlineNow] = await Promise.all([
      getTypingNow(),
      prisma.user.count({ where: { isOnline: true } }),
    ]);
    const snapshot = {
      typingNow,
      onlineNow,
      updatedAt: new Date().toISOString(),
    };
    await redis.set('economy:pulse', JSON.stringify(snapshot), 'EX', 5);
    return snapshot;
  });

  // GET /economy/halving — current era + next halving date + live rates.
  // Used by the desktop miner / dashboard to show "next halving in X days".
  app.get('/halving', async () => {
    const era = currentHalvingEra();
    const nextEraStartMs = HALVING_ANCHOR_MS + (era + 1) * HALVING_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
    return {
      era,
      anchorAt: new Date(HALVING_ANCHOR_MS).toISOString(),
      intervalDays: HALVING_INTERVAL_DAYS,
      nextHalvingAt: new Date(nextEraStartMs).toISOString(),
      currentRates: {
        baseRatePerHourPls: getBaseRatePerHour().toString(),
        bandwidthBonusPerGbPls: getBandwidthBonusPerGB().toString(),
        peerBonusPerPeerPls: getPeerBonusPerPeer().toString(),
        maxDailyPayoutPls: getMaxDailyPayout().toString(),
      },
    };
  });

  app.get('/stats', async () => {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* fallthrough */ }
    }
    const [burned, circulating] = await Promise.all([
      totalBurned(),
      circulatingSupply(),
    ]);
    const snapshot = {
      totalSupply: TOTAL_SUPPLY.toString(),
      circulating: circulating.toString(),
      burned: burned.toString(),
      // Percentage of total supply that has been permanently removed.
      // Formatted server-side for consistency across clients.
      burnedPctOfSupply: TOTAL_SUPPLY > 0n
        ? Number((burned * 1_000_000n) / TOTAL_SUPPLY) / 10_000
        : 0,
      updatedAt: new Date().toISOString(),
    };
    await redis.set(CACHE_KEY, JSON.stringify(snapshot), 'EX', CACHE_TTL_SEC);
    return snapshot;
  });
}
