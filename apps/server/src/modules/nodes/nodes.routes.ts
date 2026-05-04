import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import {
  registerNode, rotateToken, deleteNode, submitProof, listMyNodes, listPublicNodes,
  isNodesEnabled, setNodesEnabled, pendingRewardsFor, findNodeByToken,
  reportTunneledNodes, nodeStats,
  NodesError,
  BASE_RATE_PER_HOUR, BANDWIDTH_BONUS_PER_GB, PEER_BONUS_PER_PEER,
  MAX_DAILY_PAYOUT, MIN_UPTIME_FOR_FIRST_PAYOUT_HOURS, PROOF_INTERVAL_SECONDS,
  FREEZE_HOURS, MIN_VERIFICATION_LEVEL_TO_REGISTER,
} from './nodes.service.js';

export async function nodesRoutes(app: FastifyInstance) {
  // ─── Public routes (no auth) ───────────────────────────────────────
  app.get('/config', async () => ({
    enabled: await isNodesEnabled(),
    baseRatePerHour: BASE_RATE_PER_HOUR.toString(),
    bandwidthBonusPerGB: BANDWIDTH_BONUS_PER_GB.toString(),
    peerBonusPerPeer: PEER_BONUS_PER_PEER.toString(),
    maxDailyPayout: MAX_DAILY_PAYOUT.toString(),
    minUptimeHours: MIN_UPTIME_FOR_FIRST_PAYOUT_HOURS,
    proofIntervalSeconds: PROOF_INTERVAL_SECONDS,
    freezeHours: FREEZE_HOURS,
    minVerificationLevel: MIN_VERIFICATION_LEVEL_TO_REGISTER,
  }));

  app.get('/public', async () => ({ nodes: await listPublicNodes() }));

  // Internal heartbeat from the relay container — tells us which node
  // tunnels are currently open so /public can advertise them.
  app.post<{ Body: { nodeIds: string[] } }>('/_relay/heartbeat', async (request, reply) => {
    const expected = process.env.RELAY_HEARTBEAT_SECRET;
    if (!expected) return reply.status(503).send({ error: 'NOT_CONFIGURED' });
    const provided = request.headers['x-relay-secret'];
    if (provided !== expected) return reply.status(401).send({ error: 'BAD_SECRET' });
    const ids = Array.isArray(request.body?.nodeIds) ? request.body.nodeIds : [];
    await reportTunneledNodes(ids);
    return { ok: true, count: ids.length };
  });

  // Bearer-token-only lookup. Lets the desktop app find its own
  // nodeId + owner display name from just the token the user pastes
  // — saves them from manually copying both fields.
  app.get('/by-token', async (request, reply) => {
    const auth = request.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return reply.status(401).send({ error: 'NO_TOKEN' });
    const node = await findNodeByToken(token);
    if (!node) return reply.status(404).send({ error: 'NOT_FOUND' });
    return node;
  });

  // Per-node earnings dashboard for the desktop app. Same auth as /proof:
  // bearer token (which the runner already has, no separate auth needed).
  app.get<{ Params: { nodeId: string } }>('/:nodeId/stats', async (request, reply) => {
    const auth = request.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return reply.status(401).send({ error: 'NO_TOKEN' });
    try {
      return await nodeStats(request.params.nodeId, token);
    } catch (err) {
      if (err instanceof NodesError) {
        const status = err.code === 'UNAUTHORIZED' ? 401 : 400;
        return reply.status(status).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // Proof submission: bearer token in Authorization header.
  app.post<{
    Params: { nodeId: string };
    Body: { bytesRelayed?: string; activeConnections?: number; uniquePeers?: number };
  }>('/:nodeId/proof', async (request, reply) => {
    const auth = request.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return reply.status(401).send({ error: 'NO_TOKEN' });
    try {
      return await submitProof(request.params.nodeId, token, {
        bytesRelayed: BigInt(request.body?.bytesRelayed ?? '0'),
        activeConnections: request.body?.activeConnections ?? 0,
        uniquePeers: request.body?.uniquePeers ?? 0,
      });
    } catch (err) {
      if (err instanceof NodesError) {
        const status = err.code === 'UNAUTHORIZED' ? 401
          : err.code === 'BANNED' ? 403
          : err.code === 'RATE_LIMIT' ? 429
          : 400;
        return reply.status(status).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // ─── Authenticated user routes ─────────────────────────────────────
  // We check auth manually per-route instead of using a nested plugin —
  // the latter sometimes drops route prefixing in Fastify v4 when the
  // parent has no prefix.
  app.get('/my', { preHandler: authMiddleware }, async (request) => {
    const userId = request.user!.userId;
    const [nodes, pending] = await Promise.all([
      listMyNodes(userId),
      pendingRewardsFor(userId),
    ]);
    return { nodes, pendingRewards: pending.toString() };
  });

  app.post<{ Body: { endpoint?: string; label?: string } }>(
    '/register',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const result = await registerNode(request.user!.userId, request.body || {});
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof NodesError) {
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    },
  );

  app.post<{ Params: { nodeId: string } }>(
    '/:nodeId/rotate-token',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        return await rotateToken(request.user!.userId, request.params.nodeId);
      } catch (err) {
        if (err instanceof NodesError) return reply.status(404).send({ error: err.code });
        throw err;
      }
    },
  );

  app.delete<{ Params: { nodeId: string } }>(
    '/:nodeId',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        await deleteNode(request.user!.userId, request.params.nodeId);
        return { ok: true };
      } catch (err) {
        if (err instanceof NodesError) return reply.status(404).send({ error: err.code });
        throw err;
      }
    },
  );

  app.get<{ Params: { nodeId: string } }>(
    '/:nodeId/rewards',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const userId = request.user!.userId;
      const node = await prisma.relayNode.findUnique({ where: { id: request.params.nodeId } });
      if (!node || node.ownerId !== userId) return reply.status(404).send({ error: 'NOT_FOUND' });
      const rows = await prisma.nodeReward.findMany({
        where: { nodeId: request.params.nodeId },
        orderBy: { paidAt: 'desc' },
        take: 30,
      });
      return {
        rewards: rows.map(r => ({
          id: r.id,
          amount: r.amount.toString(),
          uptimeMinutes: r.uptimeMinutes,
          bytesRelayed: r.bytesRelayed.toString(),
          uniquePeers: r.uniquePeers,
          paidAt: r.paidAt.toISOString(),
        })),
      };
    },
  );

  app.post<{ Body: { enabled: boolean } }>(
    '/toggle',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const me = await prisma.user.findUnique({
        where: { id: request.user!.userId }, select: { role: true },
      });
      if (me?.role !== 'ADMIN' && me?.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }
      const enabled = !!request.body?.enabled;
      await setNodesEnabled(enabled);
      return { enabled };
    },
  );
}
