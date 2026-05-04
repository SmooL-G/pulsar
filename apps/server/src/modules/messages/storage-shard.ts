/**
 * Sharding for miner-stored offline messages.
 *
 * Given a recipient's pubkey, deterministically pick N tunneled nodes
 * to hold copies of their offline messages. The day-of-year is folded
 * into the hash so assignment rotates daily — a long-down node loses
 * its load instead of taking it forever.
 *
 * No I/O here, no Prisma. Just sort keys + slice. Fully unit-testable.
 *
 * Spec: docs/MINER_STORAGE.md
 */
import { createHash } from 'crypto';
import { redis } from '../../config/redis.js';

const REDIS_TUNNELED_KEY = 'relay:tunneled-nodes';
const DEFAULT_REPLICATION = 3;

/**
 * Number of replicas to fan out a single message to. Configurable via
 * env so we can crank it up before Phase 4 cuts the Postgres safety net.
 */
export const STORAGE_REPLICATION = Number(process.env.MINER_STORAGE_REPLICATION ?? DEFAULT_REPLICATION);

/**
 * Sort key for one (nodeId, recipientPubkey, dayOfYear) triple. The
 * smallest N keys = chosen shard. Stable for a calendar day, rotates
 * at 00:00 UTC.
 */
function sortKey(nodeId: string, recipientPubkey: string, dayOfYear: number): string {
  const h = createHash('blake2b512');
  h.update(nodeId);
  h.update(recipientPubkey);
  h.update(String(dayOfYear));
  return h.digest('hex');
}

/** UTC day-of-year, 1..366. Stable across server restarts. */
export function dayOfYear(date: Date = new Date()): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

/**
 * Picks the shard for a given recipient. Returns the chosen nodeIds in
 * preference order (caller can write to all 3, or to as many as it can
 * reach). If fewer than N nodes are available, returns whatever's
 * online — graceful degradation, never throws.
 *
 * Pure given the inputs: same args + same tunneled set = same output.
 */
export function pickShardNodes(
  recipientPubkey: string,
  availableNodeIds: string[],
  opts: { n?: number; day?: number } = {},
): string[] {
  const n = opts.n ?? STORAGE_REPLICATION;
  const day = opts.day ?? dayOfYear();
  if (availableNodeIds.length === 0) return [];

  const ranked = availableNodeIds
    .map((id) => ({ id, key: sortKey(id, recipientPubkey, day) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, n);
  return ranked.map((r) => r.id);
}

/**
 * Wraps `pickShardNodes` with a Redis read for the live tunneled-node
 * set (kept fresh by the relay container's 10s heartbeat).
 */
export async function pickShardForRecipient(
  recipientPubkey: string,
  opts: { n?: number; day?: number } = {},
): Promise<string[]> {
  const raw = await redis.get(REDIS_TUNNELED_KEY);
  let tunneled: string[] = [];
  try {
    tunneled = raw ? JSON.parse(raw) : [];
  } catch { /* empty list — degraded */ }
  return pickShardNodes(recipientPubkey, tunneled, opts);
}
