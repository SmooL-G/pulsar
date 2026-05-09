import { prisma } from '../../config/database.js';
import { PulsarGptStatus } from '@prisma/client';
import { getTaskInfo } from './kie.client.js';

/**
 * Polls KIE.AI for the status of every PENDING async task we've launched.
 *
 * For each pending request:
 *   - success → save outputUrl, mark DONE
 *   - failed  → mark FAILED, refund the user's PLS (atomic)
 *   - still running → leave alone
 *
 * Runs every TICK_MS (5s). Cheap because most tasks finish within
 * 30-120 seconds and we keep polling time short by skipping rows older
 * than MAX_AGE_MIN (treated as TIMEOUT failures and refunded).
 */

const TICK_MS = 5_000;
const MAX_AGE_MIN = 15;       // older than this → auto-fail + refund

export function startPulsarGptWorker() {
  const tick = async () => {
    try {
      const cutoff = new Date(Date.now() - MAX_AGE_MIN * 60 * 1000);
      const pending = await prisma.pulsarGptRequest.findMany({
        where: { status: PulsarGptStatus.PENDING, kieTaskId: { not: null } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      for (const req of pending) {
        // Auto-timeout requests stuck > MAX_AGE_MIN. Refund + mark FAILED.
        if (req.createdAt < cutoff) {
          await refundAndFail(req.id, req.userId, req.pricePls, 'Timed out (>15min)');
          continue;
        }
        try {
          const info = await getTaskInfo(req.kieTaskId!);
          if (info.state === 'success' && info.resultUrls.length > 0) {
            await prisma.pulsarGptRequest.update({
              where: { id: req.id },
              data: {
                status: PulsarGptStatus.DONE,
                outputUrl: info.resultUrls[0],
                completedAt: new Date(),
              },
            });
          } else if (info.state === 'failed') {
            await refundAndFail(req.id, req.userId, req.pricePls, info.errorMessage || 'KIE task failed');
          }
          // else still pending/running — leave for next tick
        } catch (err: any) {
          // Transient KIE error — log and try again next tick
          console.warn('[pulsar-gpt-worker] poll error for', req.id, err?.message);
        }
      }
    } catch (err) {
      console.error('[pulsar-gpt-worker] tick failed:', err);
    }
  };
  setTimeout(tick, 7_000);
  setInterval(tick, TICK_MS);
}

/** Refund a charged PLS amount and mark request as FAILED. */
async function refundAndFail(requestId: string, userId: string, pricePls: bigint | null, reason: string) {
  await prisma.$transaction(async (tx) => {
    await tx.pulsarGptRequest.update({
      where: { id: requestId },
      data: {
        status: PulsarGptStatus.FAILED,
        errorMessage: reason.slice(0, 500),
        completedAt: new Date(),
      },
    });
    if (pricePls && pricePls > 0n) {
      await tx.plsWallet.update({
        where: { userId },
        data: { balance: { increment: pricePls } },
      });
      // Note: we do NOT reverse the burn — burn is a one-way commitment
      // and small enough (10% of price) that it's accepted as platform-
      // operating cost. Refund is full price; user is made whole.
    }
  });
}
