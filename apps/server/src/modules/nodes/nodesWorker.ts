import { isNodesEnabled, payoutNodes, markStale, releasePendingRewards } from './nodes.service.js';

const TICK_MS = 5 * 60 * 1000;     // every 5 min: stale-check + release sweep
const PAYOUT_HOUR_UTC = 11;        // 11:00 UTC ≈ 14:00 MSK

let lastPayoutDay = -1;
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
      const day = now.getUTCDate();

      // 2) Earn (frozen) once per day at the configured hour.
      if (hour === PAYOUT_HOUR_UTC && lastPayoutDay !== day) {
        const result = await payoutNodes();
        lastPayoutDay = day;
        console.log(`[NodesWorker] Earnings: ${result.count} nodes, ${result.paid} PLS frozen`);
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
