import { adminWs } from './admin-ws-client.js';
import { pickShardForRecipient, STORAGE_REPLICATION } from './storage-shard.js';

/**
 * Phase 1+ dual-write: when an offline DM message gets created in
 * Postgres, also fan out a copy to N=3 shard nodes via the admin-ws.
 * Receiver still reads from Postgres in Phase 1, miner copies are
 * dead-store. Goal: collect challenge-success metrics over a week
 * before flipping read traffic to Phase 2.
 *
 * Spec: pulsar/docs/MINER_STORAGE.md
 */

const PHASE = Number(process.env.MINER_STORAGE_PHASE ?? 0);
/** Default 30d, overridable via env. Aligned with desktop SQLite default. */
const RETENTION_HOURS = Number(process.env.MINER_STORAGE_RETENTION_HOURS ?? 24 * 30);

/** No-op when phase < 1 OR adminWs not connected — caller doesn't have to check. */
export function isMinerStorageEnabled(): boolean {
  return PHASE >= 1 && adminWs.isReady();
}

/**
 * Fans out one message to N shard nodes. Fire-and-forget — does NOT
 * block the message:new socket emit. If 0 nodes online, drops silently
 * (Postgres write already happened; no degradation for receiver).
 */
export async function dualWriteOfflineMessage(args: {
  messageId: string;
  recipientPubkey: string;       // we use userId here for now — see note
  ciphertext: string;             // base64-encoded blob
}): Promise<void> {
  if (!isMinerStorageEnabled()) return;

  // NB: Phase 1 uses recipient's userId as the routing key. When E2E
  // ratchet keys are deployed (Phase 5+), switch to a stable per-device
  // pubkey. The sharding function only cares about determinism, the
  // value itself doesn't have to be a literal pubkey.
  const shard = await pickShardForRecipient(args.recipientPubkey);
  if (shard.length === 0) return;

  const expiresAt = Math.floor(Date.now() / 1000) + RETENTION_HOURS * 3600;
  for (const nodeId of shard) {
    adminWs.sendToNode(nodeId, {
      type: 'store',
      id: args.messageId,
      recipient: args.recipientPubkey,
      ciphertext: args.ciphertext,
      expiresAt,
    });
  }

  // Best-effort logging only — `Stored` responses arrive asynchronously
  // and are tracked by the challenge loop, not by this call.
  console.log(
    `[miner-storage] msg ${args.messageId.slice(0, 8)} fanned out to ${shard.length}/${STORAGE_REPLICATION}`,
  );
}
