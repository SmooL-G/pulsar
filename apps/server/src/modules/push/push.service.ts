import webpush from 'web-push';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return false;
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a notification to all of a user's registered devices.
 * Stale subscriptions (404/410) are pruned automatically.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureVapid()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        // Touch lastUsedAt async, ignore failures
        prisma.pushSubscription
          .update({ where: { id: s.id }, data: { lastUsedAt: new Date() } })
          .catch(() => {});
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          stale.push(s.id);
        } else {
          // Log but don't throw — one bad endpoint shouldn't break the batch
          console.warn('[push] send error', status, err?.body || err?.message);
        }
      }
    }),
  );

  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: stale } } }).catch(() => {});
  }
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
}

export function getPublicVapidKey(): string {
  return env.VAPID_PUBLIC_KEY || '';
}
