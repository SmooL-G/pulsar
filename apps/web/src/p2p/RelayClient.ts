/**
 * Client for the public signaling relays. Wraps a single WebSocket,
 * subscribes to our pubkey, exposes a publish() method, and dispatches
 * incoming packets to listeners.
 *
 * One instance per browser tab. If the active relay drops, we cycle to
 * the next entry in the list. If all fail, the calling code should fall
 * back to the legacy server-socket signaling path automatically (see
 * PeerConnection's emit helpers).
 */
import { pickRelays, bootstrapRelays } from './relays';

type PacketHandler = (from: string, payload: any) => void;

interface OutgoingPublish {
  to: string;
  payload: any;
}

class RelayClient {
  private ws: WebSocket | null = null;
  private myPubkey: string | null = null;
  private currentUrl: string | null = null;
  private candidates: string[] = [];
  private candidateIdx = 0;
  private connected = false;
  private subscribed = false;
  private pendingQueue: OutgoingPublish[] = [];
  private listeners = new Set<PacketHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  start(myPubkey: string) {
    if (this.myPubkey === myPubkey && this.ws) return; // idempotent
    this.myPubkey = myPubkey;
    // Bootstrap fetches /api/v1/nodes/public and merges community nodes
    // into the relay candidate list. Wait for it (with a 1.5s ceiling)
    // so we actually pick a community node — kicking off with the seed
    // list immediately makes the reference relay always win the race
    // and community nodes never see traffic.
    Promise.race([
      bootstrapRelays(),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]).finally(() => {
      if (this.myPubkey !== myPubkey) return; // user logged out mid-fetch
      this.candidates = pickRelays();
      this.candidateIdx = 0;
      this.openNext();
    });
  }

  stop() {
    this.myPubkey = null;
    this.subscribed = false;
    this.connected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(1000, 'client stop'); } catch { /* ignore */ }
      this.ws = null;
    }
    this.pendingQueue = [];
  }

  isReady(): boolean {
    return this.connected && this.subscribed;
  }

  publish(to: string, payload: any) {
    if (this.isReady() && this.ws) {
      try {
        this.ws.send(JSON.stringify({ kind: 'publish', to, payload }));
        return true;
      } catch (err) {
        console.warn('[relay] send failed:', err);
      }
    }
    // Buffer up to 50 events while connecting; over that = drop oldest.
    this.pendingQueue.push({ to, payload });
    if (this.pendingQueue.length > 50) this.pendingQueue.shift();
    return false;
  }

  onPacket(fn: PacketHandler) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private openNext() {
    if (!this.myPubkey || this.candidates.length === 0) return;
    const url = this.candidates[this.candidateIdx % this.candidates.length];
    this.currentUrl = url;
    console.log('[relay] connecting to', url);

    let ws: WebSocket;
    try { ws = new WebSocket(url); }
    catch (err) {
      console.warn('[relay] construct failed:', err);
      this.scheduleNext();
      return;
    }

    this.ws = ws;
    this.connected = false;
    this.subscribed = false;

    const watchdog = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        try { ws.close(); } catch { /* ignore */ }
      }
    }, 6000);

    ws.onopen = () => {
      clearTimeout(watchdog);
      this.connected = true;
      console.log('[relay] open', url);
      ws.send(JSON.stringify({ kind: 'subscribe', pubkey: this.myPubkey }));
    };

    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.kind === 'subscribed') {
        this.subscribed = true;
        // Flush pending publishes.
        for (const p of this.pendingQueue) {
          try { ws.send(JSON.stringify({ kind: 'publish', ...p })); } catch { /* ignore */ }
        }
        this.pendingQueue = [];
        return;
      }
      if (msg.kind === 'packet') {
        for (const fn of this.listeners) {
          try { fn(msg.from, msg.payload); } catch (err) { console.warn('[relay] handler threw', err); }
        }
        return;
      }
      if (msg.kind === 'error') {
        console.warn('[relay] error from', url, msg);
      }
    };

    ws.onclose = () => {
      clearTimeout(watchdog);
      this.connected = false;
      this.subscribed = false;
      if (this.ws === ws) this.ws = null;
      // If the user logged out we don't reconnect.
      if (this.myPubkey) this.scheduleNext();
    };

    ws.onerror = () => { /* close handler will reconnect */ };
  }

  private scheduleNext() {
    if (!this.myPubkey) return;
    this.candidateIdx++;
    // Re-pick the candidate list each cycle so community nodes
    // discovered after start() (via bootstrapRelays) join the rotation.
    this.candidates = pickRelays();
    // Backoff so we don't spin if every relay is down: 1s after first
    // failure, 5s after second, 15s thereafter.
    const tries = Math.floor(this.candidateIdx / Math.max(1, this.candidates.length));
    const delay = tries === 0 ? 1000 : tries === 1 ? 5000 : 15000;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.openNext(), delay);
  }
}

export const relayClient = new RelayClient();
