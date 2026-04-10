import Redis from 'ioredis';
import { createHmac } from 'crypto';
import { env } from '../../config/env.js';

const RETRY_ZSET = 'bot:webhook:retry';
const MAIN_QUEUE = 'bot:webhook:queue';
const MAX_RETRIES = 4;
const TIMEOUT_MS = 10_000;

interface WebhookJob {
  botId: string;
  updateId: string;
  webhookUrl: string;
  webhookSecret: string | null;
  payload: unknown;
  attempt: number;
  nextRetryAt: number;
}

function hmacSign(payload: unknown, secret: string): string {
  return createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

export async function startWebhookWorker() {
  const workerRedis = new Redis(env.REDIS_URL);
  const retryRedis = new Redis(env.REDIS_URL);

  console.log('[WebhookWorker] Started');

  // Retry scheduler: every 5s move due retries to main queue
  const retryInterval = setInterval(async () => {
    try {
      const due = await retryRedis.zrangebyscore(RETRY_ZSET, 0, Date.now());
      for (const item of due) {
        await retryRedis.multi()
          .zrem(RETRY_ZSET, item)
          .rpush(MAIN_QUEUE, item)
          .exec();
      }
    } catch { /* ignore */ }
  }, 5_000);

  // Main worker loop
  while (true) {
    try {
      const result = await workerRedis.blpop(MAIN_QUEUE, 5);
      if (!result) continue;

      const job: WebhookJob = JSON.parse(result[1]);

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Pulsar-Bot-Id': job.botId,
          'X-Pulsar-Update-Id': job.updateId,
        };

        if (job.webhookSecret) {
          headers['X-Pulsar-Signature'] = `sha256=${hmacSign(job.payload, job.webhookSecret)}`;
        }

        const res = await fetch(job.webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(job.payload),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok && job.attempt < MAX_RETRIES) {
          scheduleRetry(retryRedis, job);
        }
      } catch {
        if (job.attempt < MAX_RETRIES) {
          scheduleRetry(retryRedis, job);
        }
      }
    } catch (err) {
      console.error('[WebhookWorker] loop error:', err);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // (unreachable, but good practice)
  clearInterval(retryInterval);
}

function scheduleRetry(client: Redis, job: WebhookJob) {
  const delay = 10_000 * Math.pow(3, job.attempt); // 10s, 30s, 90s, 270s
  const next: WebhookJob = { ...job, attempt: job.attempt + 1, nextRetryAt: Date.now() + delay };
  client.zadd(RETRY_ZSET, next.nextRetryAt, JSON.stringify(next)).catch(() => {});
}
