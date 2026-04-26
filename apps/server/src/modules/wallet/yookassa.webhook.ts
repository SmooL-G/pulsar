import type { FastifyInstance } from 'fastify';
import { markPaidAndCredit } from './yookassa.service.js';
import { sendPushToUser } from '../push/push.service.js';
import { prisma } from '../../config/database.js';

/**
 * YooKassa notification endpoint. Mounted WITHOUT auth — YooKassa hits us
 * server-to-server. We don't blindly trust the body: we re-fetch the payment
 * from YooKassa via markPaidAndCredit's path-aware logic.
 *
 * Configure in the merchant dashboard:
 *   URL: https://pulsar-chat.fun/api/v1/yookassa/webhook
 *   Events: payment.succeeded, payment.canceled
 */
export async function yookassaWebhookRoutes(app: FastifyInstance) {
  app.post('/webhook', async (request, reply) => {
    const body = request.body as any;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ ok: false });
    }
    const event = body.event as string | undefined;
    const obj = body.object as any;
    const paymentId = obj?.id;
    if (!paymentId || typeof paymentId !== 'string') {
      return reply.status(400).send({ ok: false });
    }

    if (event === 'payment.succeeded') {
      try {
        const credited = await markPaidAndCredit(paymentId);
        if (credited) {
          const purchase = await prisma.plsPurchase.findUnique({
            where: { yookassaPaymentId: paymentId },
            select: { userId: true, amountPls: true, amountRub: true },
          });
          if (purchase) {
            sendPushToUser(purchase.userId, {
              title: 'PLS top-up succeeded',
              body: `+${purchase.amountPls.toString()} PLS (${purchase.amountRub} ₽)`,
              url: '/?settings=wallet',
              tag: `topup:${paymentId}`,
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('[yookassa] webhook credit error', err);
      }
    } else if (event === 'payment.canceled') {
      await prisma.plsPurchase
        .update({
          where: { yookassaPaymentId: paymentId },
          data: { status: 'CANCELLED' },
        })
        .catch(() => {});
    }

    // Always 200 — YooKassa retries non-2xx for hours.
    return reply.send({ ok: true });
  });
}
