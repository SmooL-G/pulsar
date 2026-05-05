import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { authMiddleware } from '../../middleware/auth.js';
import { pickShardForRecipient } from '../messages/storage-shard.js';

/**
 * Dev-only round-trip test for the miner-storage protocol (Phase 0).
 * Picks the shard for a fake recipient, opens an admin WS to the
 * relay container, sends Store → waits for Stored → Fetch → waits for
 * Fetched → asserts the ciphertext matches. Returns a per-node report.
 *
 * Auth: SUPER_ADMIN. Spec: docs/MINER_STORAGE.md.
 */
const RELAY_ADMIN_URL = process.env.RELAY_ADMIN_URL ?? 'ws://relay:3030/_admin/tunnel-ws';
const ROUND_TRIP_TIMEOUT_MS = 5000;

interface NodeResult {
  nodeId: string;
  storedOk: boolean | null;       // null = no response within timeout
  fetchedOk: boolean | null;
  ciphertextMatch: boolean | null;
  error?: string;
}

export async function storageTestRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.user?.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ error: 'FORBIDDEN' });
    }
  });

  app.post<{ Body: { recipient?: string; ciphertext?: string } }>(
    '/storage-roundtrip',
    async (request, reply) => {
      const recipient = request.body?.recipient || `test_${randomUUID().slice(0, 8)}`;
      const ciphertext = request.body?.ciphertext || Buffer.from(`hello ${Date.now()}`).toString('base64');
      const msgId = randomUUID();
      const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1h

      const shardNodes = await pickShardForRecipient(recipient);
      if (shardNodes.length === 0) {
        return reply.status(503).send({
          error: 'NO_TUNNELED_NODES',
          message: 'No desktop nodes are currently holding tunnels',
        });
      }

      const secret = process.env.RELAY_HEARTBEAT_SECRET;
      if (!secret) return reply.status(503).send({ error: 'NOT_CONFIGURED' });

      // Per-node result tracker.
      const results = new Map<string, NodeResult>(
        shardNodes.map((id) => [id, { nodeId: id, storedOk: null, fetchedOk: null, ciphertextMatch: null }]),
      );

      // Open admin WS to relay.
      let ws: WebSocket;
      try {
        ws = new WebSocket(RELAY_ADMIN_URL, { headers: { 'x-relay-secret': secret } });
      } catch (err) {
        return reply.status(502).send({ error: 'RELAY_WS_OPEN_FAILED', message: String(err) });
      }

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('ws open timeout')), 3000);
        ws.once('open', () => { clearTimeout(t); resolve(); });
        ws.once('error', (e) => { clearTimeout(t); reject(e); });
      }).catch((e) => {
        try { ws?.close(); } catch {}
        throw e;
      });

      // Frame router: each response from a node updates results map.
      const responseHandlers: Array<(from: string, frame: any) => void> = [];
      ws.on('message', (raw) => {
        let msg: any;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        if (!msg.from || !msg.frame) return;
        for (const h of responseHandlers) h(msg.from, msg.frame);
      });

      // Step 1: Send Store to each shard node.
      for (const nodeId of shardNodes) {
        ws.send(JSON.stringify({
          to: nodeId,
          frame: { type: 'store', id: msgId, recipient, ciphertext, expiresAt },
        }));
      }

      // Wait for Stored responses.
      await new Promise<void>((resolve) => {
        const handler = (from: string, frame: any) => {
          if (frame.type === 'stored' && frame.id === msgId) {
            const r = results.get(from);
            if (r) r.storedOk = !!frame.ok;
            const allReplied = Array.from(results.values()).every((r) => r.storedOk !== null);
            if (allReplied) resolve();
          }
        };
        responseHandlers.push(handler);
        setTimeout(resolve, ROUND_TRIP_TIMEOUT_MS); // best-effort timeout
      });

      // Step 2: Fetch from each shard node, verify ciphertext matches.
      for (const nodeId of shardNodes) {
        ws.send(JSON.stringify({
          to: nodeId,
          frame: { type: 'fetch', recipient, since: 0 },
        }));
      }

      await new Promise<void>((resolve) => {
        const handler = (from: string, frame: any) => {
          if (frame.type === 'fetched' && frame.recipient === recipient) {
            const r = results.get(from);
            if (r) {
              const found = (frame.messages || []).find((m: any) => m.id === msgId);
              r.fetchedOk = !!found;
              r.ciphertextMatch = found ? found.ciphertext === ciphertext : false;
            }
            const allReplied = Array.from(results.values()).every((r) => r.fetchedOk !== null);
            if (allReplied) resolve();
          }
        };
        responseHandlers.push(handler);
        setTimeout(resolve, ROUND_TRIP_TIMEOUT_MS);
      });

      try { ws.close(); } catch {}

      const list = Array.from(results.values());
      const success = list.every((r) => r.storedOk && r.fetchedOk && r.ciphertextMatch);
      return {
        success,
        msgId,
        recipient,
        shardNodes,
        results: list,
      };
    },
  );
}
