import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import {
  registerNode, rotateToken, deleteNode, submitProof, listMyNodes, listPublicNodes,
  isNodesEnabled, setNodesEnabled,
  NodesError,
  BASE_RATE_PER_HOUR, BANDWIDTH_BONUS_PER_GB, PEER_BONUS_PER_PEER,
  MAX_DAILY_PAYOUT, MIN_UPTIME_FOR_FIRST_PAYOUT_HOURS, PROOF_INTERVAL_SECONDS,
} from './nodes.service.js';

export async function nodesRoutes(app: FastifyInstance) {
  // Public — used by both browser clients (relay discovery) and the
  // proof endpoint (which authenticates with a node token, not a JWT).
  app.get('/config', async () => ({
    enabled: await isNodesEnabled(),
    baseRatePerHour: BASE_RATE_PER_HOUR.toString(),
    bandwidthBonusPerGB: BANDWIDTH_BONUS_PER_GB.toString(),
    peerBonusPerPeer: PEER_BONUS_PER_PEER.toString(),
    maxDailyPayout: MAX_DAILY_PAYOUT.toString(),
    minUptimeHours: MIN_UPTIME_FOR_FIRST_PAYOUT_HOURS,
    proofIntervalSeconds: PROOF_INTERVAL_SECONDS,
  }));

  app.get('/public', async () => ({ nodes: await listPublicNodes() }));

  // Proof submission uses a per-node bearer token. Auth header format:
  //   Authorization: Bearer <token>
  // The node id is in the path so the server can look up + compare token.
  app.post<{
    Params: { nodeId: string };
    Body: { bytesRelayed?: string; activeConnections?: number; uniquePeers?: number };
  }>('/:nodeId/proof', async (request, reply) => {
    const auth = request.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return reply.status(401).send({ error: 'NO_TOKEN' });
    try {
      const result = await submitProof(request.params.nodeId, token, {
        bytesRelayed: BigInt(request.body?.bytesRelayed ?? '0'),
        activeConnections: request.body?.activeConnections ?? 0,
        uniquePeers: request.body?.uniquePeers ?? 0,
      });
      return result;
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

  // Authenticated user routes ────────────────────────────────────────
  app.register(async (instance) => {
    instance.addHook('onRequest', authMiddleware);

    instance.get('/my', async (request) => ({
      nodes: await listMyNodes(request.user!.userId),
    }));

    instance.post<{ Body: { endpoint?: string; label?: string } }>('/register', async (request, reply) => {
      try {
        const result = await registerNode(request.user!.userId, request.body || {});
        return reply.status(201).send(result);
      } catch (err) {
        if (err instanceof NodesError) {
          return reply.status(400).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    });

    instance.post<{ Params: { nodeId: string } }>('/:nodeId/rotate-token', async (request, reply) => {
      try {
        return await rotateToken(request.user!.userId, request.params.nodeId);
      } catch (err) {
        if (err instanceof NodesError) return reply.status(404).send({ error: err.code });
        throw err;
      }
    });

    instance.delete<{ Params: { nodeId: string } }>('/:nodeId', async (request, reply) => {
      try {
        await deleteNode(request.user!.userId, request.params.nodeId);
        return { ok: true };
      } catch (err) {
        if (err instanceof NodesError) return reply.status(404).send({ error: err.code });
        throw err;
      }
    });

    instance.get<{ Params: { nodeId: string } }>('/:nodeId/rewards', async (request, reply) => {
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
    });

    // Admin toggle for the entire program.
    instance.post<{ Body: { enabled: boolean } }>('/toggle', async (request, reply) => {
      const me = await prisma.user.findUnique({
        where: { id: request.user!.userId }, select: { role: true },
      });
      if (me?.role !== 'ADMIN' && me?.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }
      const enabled = !!request.body?.enabled;
      await setNodesEnabled(enabled);
      return { enabled };
    });
  });
}
