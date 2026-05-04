# Miner-stored offline messages

Decentralised storage layer for messages whose recipient is offline. Replaces
the Postgres `OfflineMessage` table over a 4-phase rollout (see ROADMAP_V2
section 17). This document is the wire-protocol spec; implementation lives in:

- `apps/server/src/modules/messages/storage-shard.ts` — sharding function
- `apps/server/src/modules/admin/storage-shard-test.routes.ts` — dev round-trip
- `pulsar-node/desktop/src-tauri/src/storage.rs` — node-side SQLite + handlers

## Why

Currently the central server (Postgres) stores every undelivered message
as `ciphertext + metadata`. Costly, and centralised. Move the ciphertext
to community-run nodes, keep only routing metadata on the server. Anti-sybil
falls out naturally from challenge-response — fake nodes that don't actually
store messages fail challenges and get zero PLS.

## Threat model

- **Server is honest-but-curious**: same as today. It signs sharding
  decisions and runs challenges, but cannot read message content (E2E
  via `nacl-box` was already solved client-side).
- **Miners are economically rational**: they will skip storage if they
  can get away with it. Defence: random challenges + reputation score.
- **Sybil attacks**: one operator runs N fake nodes for the same shard.
  Doesn't help — challenges still hit them, and they pay N× bandwidth
  to answer N× challenges, while only earning N× shards (linear, no
  multiplier benefit).

## Sharding

For each `recipientPubkey`, deterministically pick **3** active tunneled
nodes:

```
shard_nodes(pubkey, day) = top_3(
  sort_by(
    nodeId,
    key = blake2b(nodeId || pubkey || day_of_year)
  )
)
```

- Day-of-year keeps the assignment STABLE for a day, then rotates so a
  long-down node doesn't permanently lose its load.
- Server picks from `relay:tunneled-nodes` Redis set (already maintained
  by the relay heartbeat).
- If `< 3` nodes available: `N = max(1, len(tunneled))` — degrade
  gracefully.

## Wire protocol (over the existing relay tunnel)

New frame types alongside `open`/`msg`/`close`:

### Server → Node

```
{ type: "store", id: msgId, recipient: pubkey, ciphertext: base64, expiresAt: iso8601 }
{ type: "challenge", id: msgId }                  // answer with 'proof'
{ type: "fetch", recipient: pubkey, since: iso8601 }
```

### Node → Server

```
{ type: "stored", id: msgId, ok: true }
{ type: "proof", id: msgId, hash: blake2b(ciphertext) }
{ type: "fetched", recipient: pubkey, messages: [{ id, ciphertext, createdAt }] }
{ type: "stat", storedCount, storedBytes }
```

## Retention

- Node deletes any message older than its `expiresAt` (default = 30 days
  from store time).
- Server keeps the `OfflineMessageShard` log (which msgIds went to which
  nodes) for at least 90 days for forensics.

## Reward formula additions (Phase 2+)

```
storage_reward = 1 PLS per (GB-day stored, validated by challenges)
retrieval_reward = 0.001 PLS per message served
```

Storage reward is paid hourly based on `stored_bytes × hours / (1024^3 × 24)`
× per-day rate. Challenges that fail in the last hour zero out that node's
storage reward for that hour.

## Phase rollout

Tracking ROADMAP_V2 section 17. Each phase is gated by a feature flag:

| Phase | Flag | Behaviour |
|---|---|---|
| 0 — Foundation | `MINER_STORAGE_PHASE=0` | Plumbing only, no messages routed |
| 1 — Dual-write | `MINER_STORAGE_PHASE=1` | Server writes to both Postgres AND nodes |
| 2 — Dual-read beta | `MINER_STORAGE_PHASE=2` | Opt-in users read from nodes first |
| 3 — Production | `MINER_STORAGE_PHASE=3` | Default-on, Postgres is fallback only |
| 4 — Pure miner | `MINER_STORAGE_PHASE=4` | Drop Postgres OfflineMessage table |

Rollback at any phase = flip the flag down. Postgres keeps full data
through Phase 3.
