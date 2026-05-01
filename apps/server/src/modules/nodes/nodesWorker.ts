import { isNodesEnabled, payoutNodes, markStale } from './nodes.service.js';

const TICK_MS = 5 * 60 * 1000;     // every 5 min: stale-check + once-a-day payout gate
const PAYOUT_HOUR_UTC = 11;        // 11:00 UTC ≈ 14:00 MSK

let lastPayoutDay = -1;

export function startNodesWorker() {
  console.log('[NodesWorker] Started');

  const tick = async () => {
    try {
      if (!(await isNodesEnabled())) return;

      // 1) Mark stale nodes every tick (cheap query).
      const staled = await markStale();
      if (staled > 0) console.log(`[NodesWorker] Marked ${staled} nodes STALE`);

      // 2) Payout once per day at the configured hour.
      const now = new Date();
      const day = now.getUTCDate();
      if (now.getUTCHours() === PAYOUT_HOUR_UTC && lastPayoutDay !== day) {
        const result = await payoutNodes();
        lastPayoutDay = day;
        console.log(`[NodesWorker] Payout: ${result.count} nodes, ${result.paid} PLS total`);
      }
    } catch (err) {
      console.error('[NodesWorker] tick error:', err);
    }
  };

  setTimeout(tick, 30_000);
  setInterval(tick, TICK_MS);
}
