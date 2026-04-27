import { drawPool, alreadyDrawnToday } from './lottery.service.js';
import { sendPushToUser } from '../push/push.service.js';

const TICK_MS = 5 * 60 * 1000;       // wake every 5 minutes
const DRAW_HOUR_UTC = 9;             // 09:00 UTC = 12:00 MSK

/**
 * Once-a-day lottery worker. We don't trust setTimeout to fire at an
 * exact wall-clock hour after a long sleep — instead we tick every 5
 * minutes, check the wall clock, and if it's our hour AND we haven't
 * drawn yet today, run both pools.
 */
export function startLotteryWorker() {
  console.log('[LotteryWorker] Started');

  const tick = async () => {
    try {
      const now = new Date();
      if (now.getUTCHours() !== DRAW_HOUR_UTC) return;
      if (await alreadyDrawnToday()) return;

      console.log('[LotteryWorker] Drawing both pools...');

      for (const pool of ['main', 'small'] as const) {
        try {
          const result = await drawPool(pool);
          if (!result) {
            console.log(`[LotteryWorker] ${pool}: no eligible candidates`);
            continue;
          }
          console.log(`[LotteryWorker] ${pool}: winner=${result.winner.username} candidates=${result.draw.candidatesCount}`);
          // Push the lucky one a notification.
          sendPushToUser(result.winner.id, {
            title: pool === 'main' ? '🎰 Главный приз!' : '🎲 Розыгрыш!',
            body: pool === 'main'
              ? `Ты выиграл 10 000 PLS в ежедневной лотерее!`
              : `Ты выиграл 1 000 PLS в ежедневной лотерее!`,
            url: '/?settings=lottery',
            tag: `lottery:${result.draw.id}`,
          }).catch(() => {});
        } catch (err) {
          console.error(`[LotteryWorker] draw ${pool} failed:`, err);
        }
      }
    } catch (err) {
      console.error('[LotteryWorker] tick error:', err);
    }
  };

  setTimeout(tick, 30_000); // first tick 30s after boot in case we just missed it
  setInterval(tick, TICK_MS);
}
