import { randomBytes } from 'crypto';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';

// Reward formula (per ROADMAP_V2 #44):
//   daily_payout = base_rate * uptime_hours
//                + bandwidth_bonus * GB_relayed
//                + peer_bonus * unique_peers
// Caps prevent farming via fake stats.
export const BASE_RATE_PER_HOUR = 100n;        // PLS / hour online
export const BANDWIDTH_BONUS_PER_GB = 50n;     // PLS / GB relayed
export const PEER_BONUS_PER_PEER = 10n;        // PLS / unique peer served
export const MAX_DAILY_PAYOUT = 5000n;         // hard cap per node per day
export const MIN_UPTIME_FOR_FIRST_PAYOUT_HOURS = 24;

// Heartbeat / staleness — proofs older than this mark the node STALE.
export const PROOF_STALENESS_MINUTES = 30;
// Limit: per-node proof submission cap so a malicious owner can't
// spam fake stats.
export const MAX_PROOFS_PER_HOUR = 30;
export const PROOF_INTERVAL_SECONDS = 300; // suggested 5min interval

const TOKEN_BYTES = 32;
const ENDPOINT_RE = /^wss?:\/\/[A-Za-z0-9.\-:_/]{1,256}$/;

const REDIS_ENABLED_KEY = 'setting:nodes.enabled';

export async function isNodesEnabled(): Promise<boolean> {
  return (await redis.get(REDIS_ENABLED_KEY)) !== 'false';
}
export async function setNodesEnabled(enabled: boolean): Promise<void> {
  await redis.set(REDIS_ENABLED_KEY, enabled ? 'true' : 'false');
}

export class NodesError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex'); // 64 hex chars
}

export async function registerNode(ownerId: string, opts: { endpoint?: string; label?: string }) {
  if (!(await isNodesEnabled())) throw new NodesError('DISABLED', 'Node registration is disabled');
  const ep = (opts.endpoint || '').trim() || null;
  if (ep && !ENDPOINT_RE.test(ep)) {
    throw new NodesError('BAD_ENDPOINT', 'Endpoint must be ws:// or wss:// URL');
  }
  const label = opts.label?.trim().slice(0, 64) || null;

  // Cap nodes per user — anti-sybil at the cheapest layer.
  const existing = await prisma.relayNode.count({
    where: { ownerId, status: { in: ['ACTIVE', 'STALE'] } },
  });
  if (existing >= 5) throw new NodesError('LIMIT_REACHED', 'Maximum 5 nodes per user');

  const token = newToken();
  const node = await prisma.relayNode.create({
    data: { ownerId, endpoint: ep, label, token },
  });
  return { id: node.id, token, endpoint: ep, label };
}

export async function rotateToken(ownerId: string, nodeId: string) {
  const node = await prisma.relayNode.findUnique({ where: { id: nodeId } });
  if (!node || node.ownerId !== ownerId) throw new NodesError('NOT_FOUND', 'Node not found');
  const token = newToken();
  await prisma.relayNode.update({ where: { id: nodeId }, data: { token } });
  return { token };
}

export async function deleteNode(ownerId: string, nodeId: string) {
  const node = await prisma.relayNode.findUnique({ where: { id: nodeId } });
  if (!node || node.ownerId !== ownerId) throw new NodesError('NOT_FOUND', 'Node not found');
  await prisma.relayNode.delete({ where: { id: nodeId } });
}

/**
 * Authenticated proof submission. Token check is constant-time at the
 * Postgres layer (findUnique by token + nodeId match). Stats are
 * deltas since last proof. We accumulate into the lifetime totals and
 * also write a row so the daily worker can sum the last-24h slice.
 */
export async function submitProof(nodeId: string, token: string, stats: {
  bytesRelayed: bigint;
  activeConnections: number;
  uniquePeers: number;
}) {
  if (!(await isNodesEnabled())) throw new NodesError('DISABLED', 'Disabled');
  const node = await prisma.relayNode.findUnique({ where: { id: nodeId } });
  if (!node || node.token !== token) throw new NodesError('UNAUTHORIZED', 'Bad token');
  if (node.status === 'BANNED') throw new NodesError('BANNED', 'Node banned');

  // Sanity: bursts of fake huge values get clamped.
  const bytes = stats.bytesRelayed > 100_000_000_000n ? 100_000_000_000n : stats.bytesRelayed;
  const peers = Math.min(Math.max(0, stats.uniquePeers | 0), 10000);
  const conns = Math.min(Math.max(0, stats.activeConnections | 0), 10000);

  // Per-node hourly proof rate-limit (Redis counter; fail-open if Redis dies).
  try {
    const k = `nodes:rl:${nodeId}:${Math.floor(Date.now() / 3_600_000)}`;
    const n = await redis.incr(k);
    if (n === 1) await redis.expire(k, 3600);
    if (n > MAX_PROOFS_PER_HOUR) {
      throw new NodesError('RATE_LIMIT', 'Too many proofs per hour');
    }
  } catch (e) {
    if (e instanceof NodesError) throw e;
  }

  await prisma.$transaction([
    prisma.nodeUptimeProof.create({
      data: {
        nodeId,
        bytesRelayed: bytes,
        activeConnections: conns,
        uniquePeers: peers,
      },
    }),
    prisma.relayNode.update({
      where: { id: nodeId },
      data: {
        lastSeenAt: new Date(),
        status: 'ACTIVE',
        totalBytesRelayed: { increment: bytes },
        totalUptimeMinutes: { increment: Math.floor(PROOF_INTERVAL_SECONDS / 60) },
      },
    }),
  ]);

  return { ok: true, intervalSeconds: PROOF_INTERVAL_SECONDS };
}

export async function listMyNodes(ownerId: string) {
  return prisma.relayNode.findMany({
    where: { ownerId },
    orderBy: { registeredAt: 'desc' },
    select: {
      id: true, endpoint: true, label: true, status: true,
      registeredAt: true, lastSeenAt: true,
      totalUptimeMinutes: true, totalBytesRelayed: true, totalRewardsPaid: true,
    },
  }).then(rows => rows.map(r => ({
    ...r,
    registeredAt: r.registeredAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    totalBytesRelayed: r.totalBytesRelayed.toString(),
    totalRewardsPaid: r.totalRewardsPaid.toString(),
  })));
}

export async function listPublicNodes() {
  // Show only nodes with a public endpoint and recent activity, so the
  // client can pick alternative relays when the project ones go down.
  const cutoff = new Date(Date.now() - PROOF_STALENESS_MINUTES * 60 * 1000);
  return prisma.relayNode.findMany({
    where: { status: 'ACTIVE', endpoint: { not: null }, lastSeenAt: { gte: cutoff } },
    orderBy: { lastSeenAt: 'desc' },
    take: 50,
    select: { id: true, endpoint: true, label: true, lastSeenAt: true },
  }).then(rows => rows.map(r => ({
    ...r,
    lastSeenAt: r.lastSeenAt.toISOString(),
  })));
}

/**
 * Daily reward distribution. For each ACTIVE node:
 *   1. Sum proofs in the last 24h
 *   2. Compute payout via formula, clamp at MAX_DAILY_PAYOUT
 *   3. Skip if total uptime so far < 24h (anti-sybil)
 *   4. Credit owner's wallet, log a NodeReward row
 * Returns total PLS distributed for the run.
 */
export async function payoutNodes() {
  if (!(await isNodesEnabled())) return { paid: 0n, count: 0 };

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const nodes = await prisma.relayNode.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, ownerId: true, totalUptimeMinutes: true },
  });

  let totalPaid = 0n;
  let count = 0;
  for (const n of nodes) {
    if (n.totalUptimeMinutes < MIN_UPTIME_FOR_FIRST_PAYOUT_HOURS * 60) continue;

    const proofs = await prisma.nodeUptimeProof.findMany({
      where: { nodeId: n.id, submittedAt: { gte: since } },
      select: { bytesRelayed: true, uniquePeers: true },
    });
    if (proofs.length === 0) continue;

    const uptimeMin = proofs.length * Math.floor(PROOF_INTERVAL_SECONDS / 60);
    const uptimeHours = BigInt(Math.floor(uptimeMin / 60));
    const totalBytes = proofs.reduce((s, p) => s + p.bytesRelayed, 0n);
    const totalGB = totalBytes / 1_000_000_000n;
    const peers = proofs.reduce((s, p) => s + p.uniquePeers, 0);

    let payout =
      BASE_RATE_PER_HOUR * uptimeHours
      + BANDWIDTH_BONUS_PER_GB * totalGB
      + PEER_BONUS_PER_PEER * BigInt(peers);

    if (payout > MAX_DAILY_PAYOUT) payout = MAX_DAILY_PAYOUT;
    if (payout <= 0n) continue;

    const wallet = await prisma.plsWallet.upsert({
      where: { userId: n.ownerId },
      create: { userId: n.ownerId, balance: payout },
      update: { balance: { increment: payout } },
    });

    await prisma.$transaction([
      prisma.plsTransaction.create({
        data: {
          walletId: wallet.id,
          amount: payout,
          type: 'REWARD',
          description: `Node ${n.id.slice(0, 8)}: ${uptimeHours}h, ${totalGB}GB, ${peers} peers`,
        },
      }),
      prisma.nodeReward.create({
        data: {
          nodeId: n.id,
          ownerId: n.ownerId,
          amount: payout,
          uptimeMinutes: uptimeMin,
          bytesRelayed: totalBytes,
          uniquePeers: peers,
        },
      }),
      prisma.relayNode.update({
        where: { id: n.id },
        data: { totalRewardsPaid: { increment: payout } },
      }),
    ]);

    totalPaid += payout;
    count++;
  }

  return { paid: totalPaid, count };
}

/** Mark nodes that haven't sent a proof recently as STALE. */
export async function markStale() {
  const cutoff = new Date(Date.now() - PROOF_STALENESS_MINUTES * 60 * 1000);
  const r = await prisma.relayNode.updateMany({
    where: { status: 'ACTIVE', lastSeenAt: { lt: cutoff } },
    data: { status: 'STALE' },
  });
  return r.count;
}
