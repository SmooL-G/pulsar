// Pulsar Home node-agent — Phase 1 stub.
//
// Posts signed heartbeats to the coordinator every HEARTBEAT_INTERVAL_SEC.
// Exposes /status on :4000 for the local Caddy proxy (so the user can see
// "I'm alive, X uptime, Y heartbeats" on pulsar.local/node/).
//
// MOCK_SIGN=true → uses an in-memory Ed25519 key (persisted to
// /var/lib/pulsar-home/shards/node-key.bin so it survives restarts).
// MOCK_SIGN=false → talks to ATECC608B over /dev/i2c-1. Not implemented
// in this stub — Phase 2 adds the I2C driver.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const {
  COORDINATOR_URL = 'https://pulsar-chat.fun',
  INSTANCE_ID = 'home-unknown',
  HEARTBEAT_INTERVAL_SEC = '30',
  MOCK_SIGN = 'true',
  SHARD_STORE_DIR = '/var/lib/pulsar-home/shards',
} = process.env;

const intervalMs = Number(HEARTBEAT_INTERVAL_SEC) * 1000;
const startedAt = Date.now();
const state = {
  heartbeatsSent: 0,
  heartbeatsAcked: 0,
  lastHeartbeatAt: null,
  lastError: null,
  shardCount: 0,
};

function loadOrCreateKeypair() {
  const keyPath = `${SHARD_STORE_DIR}/node-key.bin`;
  if (existsSync(keyPath)) {
    const seed = readFileSync(keyPath);
    return nacl.sign.keyPair.fromSeed(seed);
  }
  mkdirSync(dirname(keyPath), { recursive: true });
  const seed = nacl.randomBytes(32);
  writeFileSync(keyPath, seed, { mode: 0o600 });
  return nacl.sign.keyPair.fromSeed(seed);
}

if (MOCK_SIGN !== 'true') {
  console.warn('[node-agent] MOCK_SIGN=false but ATECC driver not implemented yet; falling back to mock.');
}
const keypair = loadOrCreateKeypair();
const publicKey = bs58.encode(keypair.publicKey);
console.log(`[node-agent] public key: ${publicKey}`);

function signHeartbeat() {
  const payload = {
    instanceId: INSTANCE_ID,
    timestamp: Date.now(),
    shardCount: state.shardCount,
    publicKey,
  };
  const message = new TextEncoder().encode(JSON.stringify(payload));
  const signature = bs58.encode(nacl.sign.detached(message, keypair.secretKey));
  return { payload, signature };
}

async function sendHeartbeat() {
  const { payload, signature } = signHeartbeat();
  try {
    const res = await fetch(`${COORDINATOR_URL}/api/v1/nodes/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payload, signature }),
    });
    state.heartbeatsSent += 1;
    state.lastHeartbeatAt = new Date().toISOString();
    if (res.ok) {
      state.heartbeatsAcked += 1;
      state.lastError = null;
    } else {
      state.lastError = `coordinator returned ${res.status}`;
    }
  } catch (err) {
    state.heartbeatsSent += 1;
    state.lastError = err.message;
  }
}

setInterval(sendHeartbeat, intervalMs);
sendHeartbeat();

createServer((req, res) => {
  if (req.url === '/status' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      instanceId: INSTANCE_ID,
      publicKey,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      coordinator: COORDINATOR_URL,
      mockSign: MOCK_SIGN === 'true',
      ...state,
    }, null, 2));
    return;
  }
  res.writeHead(404).end();
}).listen(4000, '0.0.0.0', () => {
  console.log('[node-agent] status server on :4000');
});
