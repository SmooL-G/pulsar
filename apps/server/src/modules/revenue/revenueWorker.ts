import { distributeRevenue, alreadyDistributedToday } from './revenue.service.js';

const TICK_MS = 5 * 60 * 1000;
const DISTRIBUTE_HOUR_UTC = 10; // 10:00 UTC = 13:00 MSK (after lottery at 09:00 UTC)

/**
 * Daily revenue share worker. Same pattern as the lottery worker:
 * tick every 5 minutes, run the distribution exactly once during the
 * configured hour.
 */
export function startRevenueWorker() {
  console.log('[RevenueWorker] Started');

  const tick = async () => {
    try {
      const now = new Date();
      if (now.getUTCHours() !== DISTRIBUTE_HOUR_UTC) return;
      if (await alreadyDistributedToday()) return;

      console.log('[RevenueWorker] Running distribution...');
      const result = await distributeRevenue();
      console.log(
        `[RevenueWorker] Done — paid out to ${result.distributed} chat(s), total ${result.totalPaid.toString()} PLS`,
      );
    } catch (err) {
      console.error('[RevenueWorker] tick error:', err);
    }
  };

  setTimeout(tick, 60_000);
  setInterval(tick, TICK_MS);
}
