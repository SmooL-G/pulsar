/**
 * Pulsar signaling relay — minimal pubsub for WebRTC handshake packets,
 * plus a tunnelling layer that lets desktop nodes accept browser
 * traffic without needing a public IP / port forwarding.
 *
 * Two modes for browsers:
 *   /ws            — direct, served by THIS process (legacy + fallback)
 *   /n/<nodeId>    — proxied through the tunnel that desktop node id
 *                    keeps open at /node-tunnel; lets traffic flow
 *                    through community-run nodes for PLS rewards
 *
 * Wire protocol on /ws (browser direct):
 *   client → server:
 *     { kind: "subscribe", pubkey: string }
 *     { kind: "publish",   to: string, payload: any }
 *     { kind: "ping" }
 *   server → client:
 *     { kind: "subscribed", pubkey: string }
 *     { kind: "packet",     from: string, payload: any }
 *     { kind: "pong" }
 *     { kind: "error",      code: string, message?: string }
 *
 * Tunnel framing on /node-tunnel (multiplexed sessions):
 *   server → node:
 *     { type: "open",  sid: number }            new browser connected
 *     { type: "msg",   sid: number, data: any } browser sent us a kind-message
 *     { type: "close", sid: number }            browser disconnected
 *     { type: "ping" }
 *   node → server:
 *     { type: "msg",   sid: number, data: any } deliver to browser
 *     { type: "close", sid: number }            node-side closes session
 *     { type: "pong" }
 *
 * `data` is the same pubsub protocol JSON the direct path speaks — node
 * runs its own pubsub state per sid as if each were a real WS.
 *
 * Token security: tunnel endpoint validates `?token=` by HTTP call to
 * the auth server's GET /api/v1/nodes/by-token. No DB access from this
 * container. If a token is valid, server registers nodeId → tunnel ws.
 */
import { createServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = Number(process.env.PORT ?? 3030);
const HOST = process.env.HOST ?? '0.0.0.0';
const AUTH_BASE = process.env.AUTH_BASE_URL ?? 'http://server:3001';

// pubkey → Set of currently-connected listeners (one user can have
// multiple tabs / devices).
const subscriptions = new Map<string, Set<WebSocket>>();

// nodeId → active tunnel WS from a desktop node
const tunnels = new Map<string, TunnelState>();

interface TunnelState {
  ws: WebSocket;
  nodeId: string;
  // sid → browser ws this session belongs to
  sessions: Map<number, WebSocket>;
  nextSid: number;
  bytesIn: number;
  bytesOut: number;
}

// per-direct-connection metadata
interface ConnState {
  pubkey: string | null;
  publishedThisSecond: number;
  lastSecondTick: number;
}
const conns = new WeakMap<WebSocket, ConnState>();

// per-proxied-browser metadata: which tunnel + sid this socket lives in
const proxied = new WeakMap<WebSocket, { tunnel: TunnelState; sid: number }>();

// Loose limits — generous because a real handshake bursts 10-30 ICE
// candidates in a second. Catches abusive senders, not normal use.
const MAX_PUBLISH_PER_SECOND = 60;
const MAX_PAYLOAD_BYTES = 8 * 1024;
const PUBKEY_RE = /^[A-Za-z0-9_-]{2,64}$/;
const NODE_ID_RE = /^[a-f0-9-]{36}$/i; // uuid v4

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
      tunnels: tunnels.size,
      uptime: process.uptime(),
    }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// Single WS server, manual upgrade dispatch by URL path.
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const path = url.pathname;

  // Direct pubsub
  if (path === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => handleDirect(ws, req));
    return;
  }
  // Tunnel from a desktop node
  if (path === '/node-tunnel') {
    const token = url.searchParams.get('token') ?? '';
    handleTunnelUpgrade(req, socket, head, token);
    return;
  }
  // Browser proxy: /n/<nodeId>
  const nodeMatch = path.match(/^\/n\/([a-f0-9-]+)$/i);
  if (nodeMatch) {
    const nodeId = nodeMatch[1];
    const tunnel = tunnels.get(nodeId);
    if (!tunnel) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => handleProxied(ws, tunnel));
    return;
  }
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

// ─── Direct (non-tunneled) pubsub ────────────────────────────────────
function handleDirect(ws: WebSocket, req: IncomingMessage) {
  conns.set(ws, { pubkey: null, publishedThisSecond: 0, lastSecondTick: 0 });

  // Keep-alive: ping every 30s, drop on no pong within 60s.
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const keepAlive = setInterval(() => {
    if (!alive) { try { ws.terminate(); } catch { /* ignore */ } clearInterval(keepAlive); return; }
    alive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }, 30_000);

  ws.on('close', () => { clearInterval(keepAlive); unsubscribe(ws); });
  ws.on('error', () => { /* close handler will clean up */ });

  ws.on('message', (raw) => {
    const buf = toBuffer(raw);
    if (buf.length > MAX_PAYLOAD_BYTES) { send(ws, { kind: 'error', code: 'PAYLOAD_TOO_LARGE' }); return; }
    let msg: any;
    try { msg = JSON.parse(buf.toString('utf8')); }
    catch { send(ws, { kind: 'error', code: 'BAD_JSON' }); return; }
    handlePubsubMessage(ws, msg);
  });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  console.log(`[relay] direct connection from ${ip}`);
}

function handlePubsubMessage(ws: WebSocket, msg: any) {
  const state = conns.get(ws);
  if (!state) return;

  if (msg.kind === 'ping') { send(ws, { kind: 'pong' }); return; }

  if (msg.kind === 'subscribe') {
    if (typeof msg.pubkey !== 'string' || !PUBKEY_RE.test(msg.pubkey)) {
      send(ws, { kind: 'error', code: 'BAD_PUBKEY' });
      return;
    }
    unsubscribe(ws);
    state.pubkey = msg.pubkey;
    let set = subscriptions.get(msg.pubkey);
    if (!set) { set = new Set(); subscriptions.set(msg.pubkey, set); }
    set.add(ws);
    send(ws, { kind: 'subscribed', pubkey: msg.pubkey });
    return;
  }

  if (msg.kind === 'publish') {
    if (!state.pubkey) { send(ws, { kind: 'error', code: 'NOT_SUBSCRIBED' }); return; }
    if (typeof msg.to !== 'string' || !PUBKEY_RE.test(msg.to)) { send(ws, { kind: 'error', code: 'BAD_TO' }); return; }
    const now = Math.floor(Date.now() / 1000);
    if (state.lastSecondTick !== now) { state.lastSecondTick = now; state.publishedThisSecond = 0; }
    state.publishedThisSecond++;
    if (state.publishedThisSecond > MAX_PUBLISH_PER_SECOND) { send(ws, { kind: 'error', code: 'RATE_LIMIT' }); return; }
    const targets = subscriptions.get(msg.to);
    if (!targets) return;
    const out = JSON.stringify({ kind: 'packet', from: state.pubkey, payload: msg.payload });
    for (const t of targets) {
      if (t.readyState === WebSocket.OPEN) {
        try { t.send(out); } catch { /* ignore */ }
      }
    }
    return;
  }

  send(ws, { kind: 'error', code: 'BAD_KIND' });
}

// ─── Tunnel: desktop node connects in ────────────────────────────────
async function handleTunnelUpgrade(
  req: IncomingMessage,
  socket: any,
  head: Buffer,
  token: string,
) {
  if (!token || token.length < 32 || token.length > 128) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  // Validate via auth server: returns the nodeId if valid.
  let nodeId: string;
  try {
    const r = await fetch(`${AUTH_BASE}/api/v1/nodes/by-token`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j: any = await r.json();
    nodeId = j.nodeId;
    if (!nodeId || !NODE_ID_RE.test(nodeId)) throw new Error('bad nodeId');
  } catch (err) {
    console.warn(`[tunnel] token validation failed: ${(err as Error).message}`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // Replace any existing tunnel for this node (last writer wins).
  const existing = tunnels.get(nodeId);
  if (existing) {
    try { existing.ws.close(1000, 'replaced'); } catch { /* ignore */ }
    closeTunnel(existing);
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    const tunnel: TunnelState = {
      ws, nodeId,
      sessions: new Map(),
      nextSid: 1,
      bytesIn: 0, bytesOut: 0,
    };
    tunnels.set(nodeId, tunnel);
    console.log(`[tunnel] node ${nodeId.slice(0, 8)} connected (total: ${tunnels.size})`);

    let alive = true;
    ws.on('pong', () => { alive = true; });
    const keepAlive = setInterval(() => {
      if (!alive) { try { ws.terminate(); } catch { /* ignore */ } clearInterval(keepAlive); return; }
      alive = false;
      try { ws.ping(); } catch { /* ignore */ }
    }, 30_000);

    ws.on('message', (raw) => handleTunnelMessage(tunnel, raw));
    ws.on('close', () => {
      clearInterval(keepAlive);
      closeTunnel(tunnel);
      tunnels.delete(nodeId);
      console.log(`[tunnel] node ${nodeId.slice(0, 8)} disconnected (total: ${tunnels.size})`);
    });
    ws.on('error', () => { /* close handler cleans up */ });
  });
}

function handleTunnelMessage(tunnel: TunnelState, raw: WebSocket.RawData) {
  const buf = toBuffer(raw);
  if (buf.length > MAX_PAYLOAD_BYTES * 2) return; // generous, framing has overhead
  tunnel.bytesIn += buf.length;
  let frame: any;
  try { frame = JSON.parse(buf.toString('utf8')); } catch { return; }

  if (frame.type === 'pong') return;
  if (typeof frame.sid !== 'number') return;
  const browser = tunnel.sessions.get(frame.sid);
  if (!browser) return;
  if (frame.type === 'msg') {
    if (browser.readyState === WebSocket.OPEN) {
      try { browser.send(JSON.stringify(frame.data)); } catch { /* ignore */ }
    }
    return;
  }
  if (frame.type === 'close') {
    try { browser.close(1000, frame.reason || 'tunnel close'); } catch { /* ignore */ }
    tunnel.sessions.delete(frame.sid);
    return;
  }
}

function closeTunnel(tunnel: TunnelState) {
  for (const browser of tunnel.sessions.values()) {
    try { browser.close(1011, 'tunnel down'); } catch { /* ignore */ }
  }
  tunnel.sessions.clear();
}

// ─── Browser proxied through a tunnel ────────────────────────────────
function handleProxied(browser: WebSocket, tunnel: TunnelState) {
  const sid = tunnel.nextSid++;
  tunnel.sessions.set(sid, browser);
  proxied.set(browser, { tunnel, sid });
  // Tell node about the new logical session.
  send(tunnel.ws, { type: 'open', sid });

  let alive = true;
  browser.on('pong', () => { alive = true; });
  const keepAlive = setInterval(() => {
    if (!alive) { try { browser.terminate(); } catch { /* ignore */ } clearInterval(keepAlive); return; }
    alive = false;
    try { browser.ping(); } catch { /* ignore */ }
  }, 30_000);

  browser.on('message', (raw) => {
    const buf = toBuffer(raw);
    if (buf.length > MAX_PAYLOAD_BYTES) return;
    tunnel.bytesOut += buf.length;
    let msg: any;
    try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }
    send(tunnel.ws, { type: 'msg', sid, data: msg });
  });

  browser.on('close', () => {
    clearInterval(keepAlive);
    if (tunnel.sessions.get(sid) === browser) {
      tunnel.sessions.delete(sid);
      send(tunnel.ws, { type: 'close', sid });
    }
  });
  browser.on('error', () => { /* close cleans up */ });
}

// ─── Helpers ─────────────────────────────────────────────────────────
function toBuffer(raw: WebSocket.RawData): Buffer {
  return Buffer.isBuffer(raw)
    ? raw
    : Array.isArray(raw)
      ? Buffer.concat(raw)
      : Buffer.from(raw as ArrayBuffer);
}

// Periodic heartbeat to auth server: which node-tunnels are open right
// now. Server stores them in Redis so /api/v1/nodes/public can advertise
// them. If this fails, public listing eventually drops them (Redis TTL).
const HEARTBEAT_SECRET = process.env.RELAY_HEARTBEAT_SECRET;
const HEARTBEAT_INTERVAL_MS = 10_000;
async function sendHeartbeat() {
  if (!HEARTBEAT_SECRET) return;
  const nodeIds = Array.from(tunnels.keys());
  try {
    await fetch(`${AUTH_BASE}/api/v1/nodes/_relay/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-relay-secret': HEARTBEAT_SECRET,
      },
      body: JSON.stringify({ nodeIds }),
    });
  } catch (err) {
    console.warn('[relay] heartbeat failed:', (err as Error).message);
  }
}
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

httpServer.listen(PORT, HOST, () => {
  console.log(`[relay] listening on ${HOST}:${PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`[relay] ${signal} received, closing ${wss.clients.size} sockets`);
  for (const ws of wss.clients) { try { ws.close(1001, 'server shutdown'); } catch { /* ignore */ } }
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
