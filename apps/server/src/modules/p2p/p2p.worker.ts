import { prisma } from '../../config/database.js';
import { P2POfferStatus, P2PTradeStatus } from '@prisma/client';

const TICK_MS = 60_000; // every minute

/**
 * Auto-cancels P2P trades whose payment window expired without the
 * buyer marking paid. Returns the reserved PLS to the offer's
 * remainingAmount. Runs every minute.
 */
export function startP2PWorker() {
  const tick = async () => {
    try {
      const now = new Date();
      const expired = await prisma.p2PTrade.findMany({
        where: { status: P2PTradeStatus.PENDING_PAYMENT, expiresAt: { lt: now } },
        select: { id: true, offerId: true, amount: true },
        take: 50,
      });
      for (const t of expired) {
        try {
          await prisma.$transaction([
            prisma.p2PTrade.update({
              where: { id: t.id },
              data: { status: P2PTradeStatus.CANCELLED, cancelledAt: now, paymentNote: '[AUTO] payment window expired' },
            }),
            prisma.p2POffer.update({
              where: { id: t.offerId },
              data: { remainingAmount: { increment: t.amount } },
            }),
          ]);
        } catch (err) {
          console.error('[p2p-worker] failed to auto-cancel trade', t.id, err);
        }
      }
      if (expired.length > 0) {
        console.log(`[p2p-worker] auto-cancelled ${expired.length} expired trade(s)`);
      }
    } catch (err) {
      console.error('[p2p-worker] tick failed:', err);
    }
  };
  setTimeout(tick, 5_000);
  setInterval(tick, TICK_MS);
}
