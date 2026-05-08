import type { FastifyInstance } from 'fastify';
import { redis } from '../../config/redis.js';
import { totalBurned, circulatingSupply } from './burn.service.js';
import { TOTAL_SUPPLY } from '../staking/staking.service.js';

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
