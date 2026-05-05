import WebSocket from 'ws';

/**
 * Singleton WebSocket client to the relay container's `/_admin/tunnel-ws`
 * endpoint. Stays open for the server's lifetime; reconnects with backoff.
 *
 * Used by Phase 1+ to push miner-storage frames (Store / Challenge /
 * Fetch) to specific node tunnels and receive their responses.
 *
 * Why a singleton: opening one WS per request (like the round-trip test
 * does) is fine for once-a-day admin pings, but the Phase 1 dual-write
 * happens per-message — too much handshake overhead.
 *
 * Spec: docs/MINER_STORAGE.md.
 */

const RELAY_ADMIN_URL = process.env.RELAY_ADMIN_URL ?? 'ws://relay:3030/_admin/tunnel-ws';
const RECONNECT_DELAYS_MS = [1_000, 3_000, 7_000, 15_000, 30_000];

type ResponseHandler = (from: string, frame: any) => void;

class AdminWsClient {
  private ws: WebSocket | null = null;
  private connecting = false;
  private reconnectAttempt = 0;
  private listeners = new Set<ResponseHandler>();
  /** Set when the env vars are missing — disables the feature silently. */
  private disabled = false;

  start(): void {
    const secret = process.env.RELAY_HEARTBEAT_SECRET;
    if (!secret) {
      console.warn('[admin-ws] RELAY_HEARTBEAT_SECRET unset — miner storage disabled');
      this.disabled = true;
      return;
    }
    this.openConnection();
  }

  isReady(): boolean {
    return !this.disabled && this.ws?.readyState === WebSocket.OPEN;
  }

  /** Push a frame to a specific node tunnel. Fire-and-forget, no await. */
  sendToNode(nodeId: string, frame: any): boolean {
    if (!this.isReady()) return false;
    try {
      this.ws!.send(JSON.stringify({ to: nodeId, frame }));
      return true;
    } catch (err) {
      console.warn('[admin-ws] send failed:', err);
      return false;
    }
  }

  /** Subscribe to ALL responses arriving on this admin ws. Returns an
   *  unsubscribe fn. Caller filters by frame.type / frame.id as needed. */
  onResponse(fn: ResponseHandler): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private openConnection(): void {
    if (this.disabled || this.connecting) return;
    this.connecting = true;
    const secret = process.env.RELAY_HEARTBEAT_SECRET!;
    let ws: WebSocket;
    try {
      ws = new WebSocket(RELAY_ADMIN_URL, { headers: { 'x-relay-secret': secret } });
    } catch (err) {
      this.connecting = false;
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.on('open', () => {
      console.log('[admin-ws] connected to relay');
      this.connecting = false;
      this.reconnectAttempt = 0;
    });

    ws.on('message', (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg.from || !msg.frame) return;
      for (const fn of this.listeners) {
        try { fn(msg.from, msg.frame); } catch (err) {
          console.warn('[admin-ws] listener threw:', err);
        }
      }
    });

    ws.on('close', () => {
      this.connecting = false;
      if (this.ws === ws) this.ws = null;
      this.scheduleReconnect();
    });

    ws.on('error', () => { /* close handler will reconnect */ });
  }

  private scheduleReconnect(): void {
    const delay = RECONNECT_DELAYS_MS[
      Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
    ];
    this.reconnectAttempt++;
    setTimeout(() => this.openConnection(), delay);
  }
}

export const adminWs = new AdminWsClient();
