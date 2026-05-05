import { createHash } from 'crypto';
import { redis } from '../../config/redis.js';
import { adminWs } from './admin-ws-client.js';
import { pickShardForRecipient } from './storage-shard.js';
import { prisma } from '../../config/database.js';

/**
 * Storage health monitor.
 *
 * Every 10 minutes:
 *   1. Picks up to 20 random recently-stored DM messages.
 *   2. For each, computes the expected SHA-256 of its ciphertext.
 *   3. Sends a `Challenge { id }` to each shard node and waits up to
 *      5 seconds for the matching `Proof { id, hash }` response.
 *   4. Compares: hash matches → +1 OK; mismatch / timeout → +1 FAIL.
 *   5. Writes a rolling 24h success rate to Redis for the admin dashboard.
 *
 * Spec: pulsar/docs/MINER_STORAGE.md.
 */

const PHASE = Number(process.env.MINER_STORAGE_PHASE ?? 0);
const TICK_MS = 10 * 60 * 1000;             // 10 min
const SAMPLE_SIZE = 20;                      // messages per tick
const RESPONSE_WAIT_MS = 5_000;              // per-tick wait
const REDIS_HEALTH_KEY = 'miner-storage:health';

interface HealthSample {
  ts: number;     // unix ms
  ok: number;
  fail: number;
}

export function startStorageChallengeWorker(): void {
  if (PHASE < 1) {
    console.log('[storage-challenge] disabled (MINER_STORAGE_PHASE < 1)');
    return;
  }
  console.log('[storage-challenge] worker started (10min tick)');
  setTimeout(() => { void tick(); }, 60_000);          // first run after 1 min
  setInterval(() => { void tick(); }, TICK_MS);
}

async function tick(): Promise<void> {
  if (!adminWs.isReady()) return;

  // Sample messages stored in the last 1h. Wider windows would include
  // pre-Phase-1 messages that were never fanned out → noisy false-fails.
  // 1h is short enough that even fresh deploys produce honest metrics
  // within an hour of the first user activity.
  const since = new Date(Date.now() - 3600 * 1000);
  const sample = await prisma.message.findMany({
    where: {
      createdAt: { gte: since },
      encryptedContent: { not: null },
      chat: { type: 'DIRECT' },
    },
    select: {
      id: true,
      encryptedContent: true,
      chatId: true,
      senderId: true,
    },
    orderBy: { createdAt: 'desc' },
    take: SAMPLE_SIZE * 5, // overfetch — we'll pick offline recipients
  });
  if (sample.length === 0) return;

  let ok = 0;
  let fail = 0;

  // Subscribe once for this tick to all admin-ws responses, dispatch
  // by msgId via a local map.
  type Pending = { resolve: (hash: string | null) => void };
  const pending = new Map<string, Map<string, Pending>>(); // msgId → nodeId → pending
  const unsub = adminWs.onResponse((from, frame) => {
    if (frame.type !== 'proof' || typeof frame.id !== 'string') return;
    const inner = pending.get(frame.id);
    const p = inner?.get(from);
    if (p) {
      p.resolve(frame.hash ?? null);
      inner!.delete(from);
    }
  });

  try {
    for (const msg of sample.slice(0, SAMPLE_SIZE)) {
      if (!msg.encryptedContent) continue;
      const recipients = await offlineRecipientsFor(msg.chatId, msg.senderId);
      if (recipients.length === 0) continue;

      const expected = sha256OfBase64(msg.encryptedContent);

      for (const rid of recipients) {
        const shard = await pickShardForRecipient(rid);
        if (shard.length === 0) continue;

        const innerMap = new Map<string, Pending>();
        pending.set(msg.id, innerMap);

        // Send Challenge to each shard node, collect proofs.
        const promises = shard.map((nodeId) => new Promise<string | null>((resolve) => {
          innerMap.set(nodeId, { resolve });
          adminWs.sendToNode(nodeId, { type: 'challenge', id: msg.id });
          setTimeout(() => resolve(null), RESPONSE_WAIT_MS);
        }));

        const proofs = await Promise.all(promises);
        for (const p of proofs) {
          if (p === expected) ok++;
          else fail++;
        }
        pending.delete(msg.id);
      }
    }
  } finally {
    unsub();
  }

  await pushSample({ ts: Date.now(), ok, fail });
  if (ok + fail > 0) {
    const rate = Math.floor((ok / (ok + fail)) * 1000) / 10;
    console.log(`[storage-challenge] tick: ${ok} ok / ${fail} fail (${rate}%)`);
  }
}

async function offlineRecipientsFor(chatId: string, senderId: string): Promise<string[]> {
  // Conservative: assume everyone except the sender is "offline" for the
  // purposes of dual-write attribution. Online vs offline at the moment
  // of the original send is what mattered; the message either landed on
  // miners or it didn't. The challenge is just verifying it's still there.
  const members = await prisma.chatMember.findMany({
    where: { chatId, leftAt: null, NOT: { userId: senderId } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

function sha256OfBase64(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  return createHash('sha256').update(buf).digest('hex');
}

async function pushSample(s: HealthSample): Promise<void> {
  // Keep last 144 samples (= 24h at 10-min ticks).
  const raw = await redis.get(REDIS_HEALTH_KEY);
  let samples: HealthSample[] = [];
  try { samples = raw ? JSON.parse(raw) : []; } catch { samples = []; }
  samples.push(s);
  if (samples.length > 144) samples = samples.slice(-144);
  await redis.set(REDIS_HEALTH_KEY, JSON.stringify(samples));
}

/** 24h rolling success rate, used by /api/v1/admin/storage-health. */
export async function readStorageHealth(): Promise<{ ok: number; fail: number; rate: number; samples: number; }> {
  const raw = await redis.get(REDIS_HEALTH_KEY);
  let samples: HealthSample[] = [];
  try { samples = raw ? JSON.parse(raw) : []; } catch { samples = []; }
  let ok = 0;
  let fail = 0;
  for (const s of samples) { ok += s.ok; fail += s.fail; }
  const total = ok + fail;
  return {
    ok,
    fail,
    rate: total === 0 ? 0 : Math.floor((ok / total) * 1000) / 10,
    samples: samples.length,
  };
}
