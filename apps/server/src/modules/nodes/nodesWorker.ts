import { isNodesEnabled, payoutNodes, markStale, releasePendingRewards } from './nodes.service.js';

const TICK_MS = 5 * 60 * 1000;     // every 5 min: stale-check + release sweep

let lastPayoutHour = -1;
let lastReleaseHour = -1;

export function startNodesWorker() {
  console.log('[NodesWorker] Started');

  const tick = async () => {
    try {
      if (!(await isNodesEnabled())) return;

      // 1) Mark stale nodes every tick (cheap query).
      const staled = await markStale();
      if (staled > 0) console.log(`[NodesWorker] Marked ${staled} nodes STALE`);

      const now = new Date();
      const hour = now.getUTCHours();

      // 2) Earnings every hour (frozen 24h before wallet credit).
      // Each call only sums proofs from the last 1h — so per-hour
      // accrual matches what the desktop projection shows live.
      if (hour !== lastPayoutHour) {
        const result = await payoutNodes();
        lastPayoutHour = hour;
        if (result.count > 0) {
          console.log(`[NodesWorker] Hourly payout: ${result.count} nodes, ${result.paid} PLS frozen`);
        }
      }

      // 3) Release matured frozen rewards once per hour.
      if (hour !== lastReleaseHour) {
        const r = await releasePendingRewards();
        lastReleaseHour = hour;
        if (r.count > 0) {
          console.log(`[NodesWorker] Released: ${r.count} rewards, ${r.released} PLS to wallets`);
        }
      }
    } catch (err) {
      console.error('[NodesWorker] tick error:', err);
    }
  };

  setTimeout(tick, 30_000);
  setInterval(tick, TICK_MS);
}
