import { prisma } from '../../config/database.js';
import { sendPushToUser } from '../push/push.service.js';
import { PREMIUM_MONTH_PRICE_PLS, PREMIUM_PERIOD_DAYS } from './premium.service.js';

const TICK_MS = 60 * 60 * 1000; // every hour — drift between checks is fine for daily-grain renewals

/**
 * Looks for subscriptions expiring within the next 24h that have autoRenew
 * on, and tries to charge the wallet. Successful charges extend by 30 days;
 * failed charges leave the subscription alone (it expires naturally) and
 * push a "your Premium ended" notification once at expiry time.
 */
export function startSubscriptionWorker() {
  console.log('[SubscriptionWorker] Started');

  const tick = async () => {
    try {
      const now = Date.now();
      const horizon = new Date(now + 24 * 3600 * 1000);

      // 1. Try to renew anything in the renewal window.
      const renewable = await prisma.subscription.findMany({
        where: {
          autoRenew: true,
          isTrial: false,
          expiresAt: { lte: horizon, gt: new Date(now) },
        },
        take: 200,
      });

      for (const sub of renewable) {
        try {
          const wallet = await prisma.plsWallet.findUnique({ where: { userId: sub.userId } });
          if (!wallet || wallet.balance < PREMIUM_MONTH_PRICE_PLS) {
            // Not enough — let it expire. We'll notify on the second pass.
            continue;
          }
          const newExpires = new Date(sub.expiresAt.getTime() + PREMIUM_PERIOD_DAYS * 24 * 3600 * 1000);
          await prisma.$transaction([
            prisma.plsWallet.update({
              where: { userId: sub.userId },
              data: { balance: { decrement: PREMIUM_MONTH_PRICE_PLS } },
            }),
            prisma.subscription.update({
              where: { userId: sub.userId },
              data: { expiresAt: newExpires },
            }),
          ]);
          // Light notice — useful for trust ("you were charged X PLS").
          sendPushToUser(sub.userId, {
            title: 'Premium renewed',
            body: `5000 PLS charged. Active until ${newExpires.toLocaleDateString()}`,
            url: '/?settings=notifications',
            tag: 'premium:renewed',
          }).catch(() => {});
        } catch (err) {
          console.error('[SubscriptionWorker] renew error for', sub.userId, err);
        }
      }

      // 2. Notify users whose subscription just expired (within last hour).
      const justExpired = await prisma.subscription.findMany({
        where: {
          expiresAt: { gt: new Date(now - TICK_MS - 60_000), lte: new Date(now) },
        },
        take: 200,
      });
      for (const sub of justExpired) {
        sendPushToUser(sub.userId, {
          title: 'Premium ended',
          body: sub.isTrial
            ? 'Your free trial just ended. Subscribe to keep Premium perks.'
            : 'Your Premium subscription expired. Top up PLS and renew anytime.',
          url: '/?settings=premium',
          tag: 'premium:expired',
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[SubscriptionWorker] tick error:', err);
    }
  };

  // First tick after 1 minute, then hourly.
  setTimeout(tick, 60_000);
  setInterval(tick, TICK_MS);
}
