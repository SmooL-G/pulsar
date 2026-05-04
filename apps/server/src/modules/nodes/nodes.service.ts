import { randomBytes } from 'crypto';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';

// Reward formula (per ROADMAP_V2 #44):
//   daily_payout = base_rate * uptime_hours
//                + bandwidth_bonus * GB_relayed
//                + peer_bonus * unique_peers
// Halved from initial values (2026-05-01) to make the runway sustainable.
// Caps prevent farming via fake stats.
export const BASE_RATE_PER_HOUR = 50n;         // PLS / hour online
export const BANDWIDTH_BONUS_PER_GB = 25n;     // PLS / GB relayed
export const PEER_BONUS_PER_PEER = 5n;         // PLS / unique peer served
export const MAX_DAILY_PAYOUT = 2500n;         // hard cap per node per day
export const MIN_UPTIME_FOR_FIRST_PAYOUT_HOURS = 24;
// Earned rewards land in NodeReward immediately but stay frozen for
// this long before they're credited to the owner's PLS wallet. Gives
// us a window to claw back fraudulent earnings before they're spent.
export const FREEZE_HOURS = 24;
// Sybil gate: only Level 3 (Elite, 25 000 PLS one-time burn) accounts
// can register relay nodes. A bot farm needs to commit that much per
// fake account before earning anything — usually unprofitable.
export const MIN_VERIFICATION_LEVEL_TO_REGISTER = 3;

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

  // Sybil gate: Elite verification (Level 3) required.
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { verificationLevel: true },
  });
  if (!user) throw new NodesError('NOT_FOUND', 'User not found');
  if (user.verificationLevel < MIN_VERIFICATION_LEVEL_TO_REGISTER) {
    throw new NodesError(
      'NOT_VERIFIED',
      `Verification Level ${MIN_VERIFICATION_LEVEL_TO_REGISTER}+ required to register a node`,
    );
  }

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

/**
 * Public host that browsers reach the relay through. Used to synthesise
 * `wss://<host>/n/<nodeId>` endpoints for tunneled nodes that don't have
 * their own public DNS / port forwarding.
 */
const PUBLIC_RELAY_HOST = process.env.PUBLIC_RELAY_HOST ?? 'pulsar-chat.fun';
const REDIS_TUNNELED_KEY = 'relay:tunneled-nodes';

export async function listPublicNodes() {
  // Surface two kinds of nodes:
  //   1. Owners who set their own public endpoint (port forward / Cloudflare)
  //   2. Nodes currently holding an outbound tunnel to our central relay
  //      — we expose them at wss://<host>/n/<id>
  // The browser bootstraps from this list and routes signaling through them.
  const cutoff = new Date(Date.now() - PROOF_STALENESS_MINUTES * 60 * 1000);
  let tunneledIds: string[] = [];
  try {
    const raw = await redis.get(REDIS_TUNNELED_KEY);
    if (raw) tunneledIds = JSON.parse(raw);
  } catch { /* fine — empty list */ }

  const rows = await prisma.relayNode.findMany({
    where: {
      status: 'ACTIVE',
      lastSeenAt: { gte: cutoff },
      OR: [
        { endpoint: { not: null } },
        ...(tunneledIds.length > 0 ? [{ id: { in: tunneledIds } }] : []),
      ],
    },
    orderBy: { lastSeenAt: 'desc' },
    take: 50,
    select: { id: true, endpoint: true, label: true, lastSeenAt: true },
  });
  return rows.map(r => ({
    id: r.id,
    label: r.label,
    // Tunneled nodes get a synthetic endpoint pointing at our relay.
    endpoint: r.endpoint || `wss://${PUBLIC_RELAY_HOST}/n/${r.id}`,
    lastSeenAt: r.lastSeenAt.toISOString(),
  }));
}

/**
 * Called by the relay container every ~10s with the current set of node
 * tunnels it's holding. Stored in Redis with a short TTL so a relay
 * crash naturally drops its nodes from the public list within 30s.
 */
export async function reportTunneledNodes(nodeIds: string[]): Promise<void> {
  const filtered = nodeIds.filter(id => /^[a-f0-9-]{36}$/i.test(id)).slice(0, 1000);
  await redis.set(REDIS_TUNNELED_KEY, JSON.stringify(filtered), 'EX', 30);
}

/**
 * Daily earnings calculation. For each ACTIVE node:
 *   1. Sum proofs in the last 24h
 *   2. Compute payout via formula, clamp at MAX_DAILY_PAYOUT
 *   3. Skip if total uptime so far < 24h (anti-sybil)
 *   4. Create a NodeReward row marked "frozen" (released=false,
 *      availableAt=now+FREEZE_HOURS). The wallet is NOT credited yet.
 *
 * The matched amount actually lands in the user's PLS wallet later via
 * `releasePendingRewards`. This gives us a 24h window to claw back
 * fraudulent earnings before they can be spent.
 */
export async function payoutNodes() {
  if (!(await isNodesEnabled())) return { paid: 0n, count: 0 };

  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const nodes = await prisma.relayNode.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, ownerId: true, totalUptimeMinutes: true },
  });

  let totalEarned = 0n;
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

    const availableAt = new Date(Date.now() + FREEZE_HOURS * 3600 * 1000);

    await prisma.nodeReward.create({
      data: {
        nodeId: n.id,
        ownerId: n.ownerId,
        amount: payout,
        uptimeMinutes: uptimeMin,
        bytesRelayed: totalBytes,
        uniquePeers: peers,
        availableAt,
      },
    });

    totalEarned += payout;
    count++;
  }

  return { paid: totalEarned, count };
}

/**
 * Per-node earnings dashboard for the desktop app. Aggregates:
 *   - lifetime PLS paid out (RelayNode.totalRewardsPaid)
 *   - last-24h PLS rewards (NodeReward.createdAt within 24h)
 *   - currently-frozen PLS (released = false)
 *   - hourly-bucketed bytes_relayed for the last 24h (sparkline data)
 *
 * Authenticated via bearer token (same as /proof).
 */
export async function nodeStats(nodeId: string, token: string) {
  const node = await prisma.relayNode.findUnique({
    where: { id: nodeId },
    select: { id: true, token: true, ownerId: true, totalRewardsPaid: true },
  });
  if (!node || node.token !== token) {
    throw new NodesError('UNAUTHORIZED', 'bad token');
  }

  const since24h = new Date(Date.now() - 24 * 3600 * 1000);

  const [todayRewardsRow, frozenRow, proofs24h] = await Promise.all([
    prisma.nodeReward.aggregate({
      where: { nodeId, createdAt: { gte: since24h } },
      _sum: { amount: true },
    }),
    prisma.nodeReward.aggregate({
      where: { nodeId, released: false },
      _sum: { amount: true },
    }),
    prisma.nodeUptimeProof.findMany({
      where: { nodeId, createdAt: { gte: since24h } },
      select: { createdAt: true, bytesRelayed: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Bucket proofs into 24 hourly slots, oldest → newest. Index 0 = the
  // hour 23h ago, index 23 = the current hour.
  const buckets = new Array<bigint>(24).fill(0n);
  const nowH = Math.floor(Date.now() / 3600_000);
  for (const p of proofs24h) {
    const proofH = Math.floor(p.createdAt.getTime() / 3600_000);
    const idx = 23 - (nowH - proofH);
    if (idx >= 0 && idx < 24) buckets[idx] += p.bytesRelayed;
  }

  return {
    lifetimeRewards: node.totalRewardsPaid.toString(),
    todayRewards: (todayRewardsRow._sum.amount ?? 0n).toString(),
    pendingFrozen: (frozenRow._sum.amount ?? 0n).toString(),
    hourlyBytes24h: buckets.map(b => b.toString()),
  };
}

/**
 * Sweep matured frozen rewards into wallets. Called hourly. Each
 * matured row gets a wallet credit + plsTransaction + nodeReward
 * marked released, all in one transaction.
 */
export async function releasePendingRewards() {
  if (!(await isNodesEnabled())) return { released: 0n, count: 0 };

  const due = await prisma.nodeReward.findMany({
    where: { released: false, availableAt: { lte: new Date() } },
    take: 100,
  });

  let totalReleased = 0n;
  let count = 0;
  for (const r of due) {
    try {
      const wallet = await prisma.plsWallet.upsert({
        where: { userId: r.ownerId },
        create: { userId: r.ownerId, balance: r.amount },
        update: { balance: { increment: r.amount } },
      });
      await prisma.$transaction([
        prisma.plsTransaction.create({
          data: {
            walletId: wallet.id,
            amount: r.amount,
            type: 'REWARD',
            description: `Node ${r.nodeId.slice(0, 8)} reward (released)`,
          },
        }),
        prisma.nodeReward.update({
          where: { id: r.id },
          data: { released: true, releasedAt: new Date() },
        }),
        prisma.relayNode.update({
          where: { id: r.nodeId },
          data: { totalRewardsPaid: { increment: r.amount } },
        }),
      ]);
      totalReleased += r.amount;
      count++;
    } catch (err) {
      console.error('[nodes] release error for', r.id, err);
    }
  }

  return { released: totalReleased, count };
}

/**
 * Find a node by its bearer token. Returns null if no match. Used by
 * the desktop runner UI so the user only needs to paste the token —
 * we look up nodeId + owner display info from there.
 */
export async function findNodeByToken(token: string) {
  if (!token || typeof token !== 'string' || token.length < 16) return null;
  const node = await prisma.relayNode.findUnique({
    where: { token },
    select: {
      id: true,
      label: true,
      endpoint: true,
      status: true,
      ownerId: true,
    },
  });
  if (!node) return null;
  const owner = await prisma.user.findUnique({
    where: { id: node.ownerId },
    select: { id: true, username: true, displayName: true },
  });
  return {
    nodeId: node.id,
    label: node.label,
    endpoint: node.endpoint,
    status: node.status,
    owner,
  };
}

/** Sum currently-frozen reward amount for a user (UI shows it as pending). */
export async function pendingRewardsFor(ownerId: string): Promise<bigint> {
  const rows = await prisma.nodeReward.findMany({
    where: { ownerId, released: false },
    select: { amount: true },
  });
  return rows.reduce((s, r) => s + r.amount, 0n);
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
