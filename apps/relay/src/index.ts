/**
 * Pulsar signaling relay — minimal pubsub for WebRTC handshake packets.
 *
 * Stateless except for an in-memory subscription table. Anyone can run
 * one. The relay does NOT inspect or sign packets — clients verify their
 * partner's identity through the WebRTC handshake itself (DTLS fingerprint
 * pinning), so a malicious relay cannot MITM a session, only refuse to
 * forward.
 *
 * Wire protocol (JSON over WebSocket):
 *   client → server:
 *     { kind: "subscribe", pubkey: string }   one per connection, identifies the listener
 *     { kind: "publish",   to: string, payload: any }
 *     { kind: "ping" }
 *   server → client:
 *     { kind: "subscribed", pubkey: string }
 *     { kind: "packet",     from: string, payload: any }
 *     { kind: "pong" }
 *     { kind: "error",      code: string, message?: string }
 *
 * `from` on a delivered packet is the publisher's subscribed pubkey
 * (whatever they claimed in their own subscribe). Receivers MUST treat
 * it as untrusted; their P2P session-level handshake is the truth.
 */
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 3030);
const HOST = process.env.HOST ?? '0.0.0.0';

// pubkey → Set of currently-connected listeners (one user can have
// multiple tabs / devices).
const subscriptions = new Map<string, Set<WebSocket>>();

// per-socket metadata
interface ConnState {
  pubkey: string | null;
  publishedThisSecond: number;
  lastSecondTick: number;
}
const conns = new WeakMap<WebSocket, ConnState>();

// Loose limits — generous because a real handshake bursts 10-30 ICE
// candidates in a second. Catches abusive senders, not normal use.
const MAX_PUBLISH_PER_SECOND = 60;
const MAX_PAYLOAD_BYTES = 8 * 1024;
const PUBKEY_RE = /^[A-Za-z0-9_-]{2,64}$/;

function send(ws: WebSocket, msg: any) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try { ws.send(JSON.stringify(msg)); } catch { /* socket closed mid-send */ }
}

function unsubscribe(ws: WebSocket) {
  const state = conns.get(ws);
  if (!state?.pubkey) return;
  const set = subscriptions.get(state.pubkey);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) subscriptions.delete(state.pubkey);
}

const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      subscribers: subscriptions.size,
      uptime: process.uptime(),
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws, req) => {
  conns.set(ws, { pubkey: null, publishedThisSecond: 0, lastSecondTick: 0 });

  // Keep-alive: ping every 30s, drop on no pong within 60s.
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const keepAlive = setInterval(() => {
    if (!alive) {
      try { ws.terminate(); } catch { /* ignore */ }
      clearInterval(keepAlive);
      return;
    }
    alive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }, 30_000);

  ws.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe(ws);
  });
  ws.on('error', () => { /* close handler will clean up */ });

  ws.on('message', (raw) => {
    if (raw.length > MAX_PAYLOAD_BYTES) {
      send(ws, { kind: 'error', code: 'PAYLOAD_TOO_LARGE' });
      return;
    }
    let msg: any;
    try { msg = JSON.parse(raw.toString('utf8')); }
    catch { send(ws, { kind: 'error', code: 'BAD_JSON' }); return; }

    const state = conns.get(ws)!;

    if (msg.kind === 'ping') { send(ws, { kind: 'pong' }); return; }

    if (msg.kind === 'subscribe') {
      if (typeof msg.pubkey !== 'string' || !PUBKEY_RE.test(msg.pubkey)) {
        send(ws, { kind: 'error', code: 'BAD_PUBKEY' });
        return;
      }
      // Replace any prior subscription on this socket.
      unsubscribe(ws);
      state.pubkey = msg.pubkey;
      let set = subscriptions.get(msg.pubkey);
      if (!set) { set = new Set(); subscriptions.set(msg.pubkey, set); }
      set.add(ws);
      send(ws, { kind: 'subscribed', pubkey: msg.pubkey });
      return;
    }

    if (msg.kind === 'publish') {
      if (!state.pubkey) {
        send(ws, { kind: 'error', code: 'NOT_SUBSCRIBED' });
        return;
      }
      if (typeof msg.to !== 'string' || !PUBKEY_RE.test(msg.to)) {
        send(ws, { kind: 'error', code: 'BAD_TO' });
        return;
      }
      // Rate-limit: simple sliding-second window.
      const now = Math.floor(Date.now() / 1000);
      if (state.lastSecondTick !== now) {
        state.lastSecondTick = now;
        state.publishedThisSecond = 0;
      }
      state.publishedThisSecond++;
      if (state.publishedThisSecond > MAX_PUBLISH_PER_SECOND) {
        send(ws, { kind: 'error', code: 'RATE_LIMIT' });
        return;
      }
      const targets = subscriptions.get(msg.to);
      if (!targets) return; // recipient offline — silently drop
      const out = JSON.stringify({ kind: 'packet', from: state.pubkey, payload: msg.payload });
      for (const t of targets) {
        if (t.readyState === WebSocket.OPEN) {
          try { t.send(out); } catch { /* ignore */ }
        }
      }
      return;
    }

    send(ws, { kind: 'error', code: 'BAD_KIND' });
  });

  // Soft IP log for "who connected" diagnostics; no rate-limit yet.
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  console.log(`[relay] connection from ${ip}`);
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[relay] listening on ${HOST}:${PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`[relay] ${signal} received, closing ${wss.clients.size} sockets`);
  for (const ws of wss.clients) {
    try { ws.close(1001, 'server shutdown'); } catch { /* ignore */ }
  }
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
