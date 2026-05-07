import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
import { getEffectivePrice } from './price.service.js';

const SNAPSHOT_TTL_DAYS = 90;
const TICK_MS = 60 * 60 * 1000; // 1 hour

/**
 * Captures one PlsPriceSnapshot per hour so the UI can draw an honest
 * 24h/7d/30d sparkline. Without this the chart would have nothing to
 * plot — the live snapshot endpoint only returns the *current* price.
 *
 * Also fires once at boot so a fresh deploy has at least one point
 * immediately, and prunes rows older than SNAPSHOT_TTL_DAYS.
 */
export function startPriceSnapshotWorker() {
  const tick = async () => {
    try {
      const eff = await getEffectivePrice();
      await prisma.plsPriceSnapshot.create({
        data: {
          pricePerPlsUsd: new Prisma.Decimal(eff.pricePerPlsUsd),
          source: eff.source,
          marketVolumePls: eff.market ? BigInt(eff.market.volumePls) : null,
        },
      });

      // Prune anything older than the visible window.
      const cutoff = new Date(Date.now() - SNAPSHOT_TTL_DAYS * 24 * 60 * 60 * 1000);
      await prisma.plsPriceSnapshot.deleteMany({ where: { createdAt: { lt: cutoff } } });
    } catch (err) {
      console.error('[price-snapshot] tick failed:', err);
    }
  };
  setTimeout(tick, 5_000);     // first sample shortly after boot
  setInterval(tick, TICK_MS);
}
