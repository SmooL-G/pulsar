import { ICE_SERVERS } from './iceServers';
import { usePeerStore } from './peerStore';
import { getSocket } from '../hooks/useSocket';
import { useMessageStore } from '../store/messageStore';
import type { Message } from '@pulsar/shared';

type DataChannelEnvelope =
  | { kind: 'message'; payload: Message }
  | { kind: 'ping' };

/**
 * One RTCPeerConnection per remote user. We keep a singleton registry
 * keyed by remote userId so the same browser tab reuses an existing
 * connection across chat re-mounts.
 *
 * Connection establishment is "polite peer" pattern (perfect-negotiation
 * lite): the side with the lexicographically smaller userId is the
 * impolite (offerer); the other is polite (answerer). This keeps both
 * sides agreeing on roles without an extra round trip.
 */
export class PeerConnection {
  readonly remoteUserId: string;
  private readonly localUserId: string;
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private readonly polite: boolean;
  private makingOffer = false;
  private ignoreOffer = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(localUserId: string, remoteUserId: string) {
    this.localUserId = localUserId;
    this.remoteUserId = remoteUserId;
    this.polite = localUserId > remoteUserId;
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.wireConnection();
    if (!this.polite) {
      // The impolite side opens the data channel; the polite side
      // receives it through ondatachannel.
      this.attachDataChannel(this.pc.createDataChannel('pulsar-msg', { ordered: true }));
    }
  }

  private setState(state: Parameters<typeof usePeerStore.getState>[never] extends never ? any : any) {
    usePeerStore.getState().setState(this.remoteUserId, state);
  }

  private wireConnection() {
    const pc = this.pc;
    const sock = () => getSocket();

    // Negotiation: fires when something changes that needs a renegotiation.
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sock()?.emit('webrtc:offer', { to: this.remoteUserId, sdp: pc.localDescription! });
      } catch (err) {
        console.error('[p2p] negotiationneeded error:', err);
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sock()?.emit('webrtc:ice', { to: this.remoteUserId, candidate: e.candidate.toJSON() });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log(`[p2p] ICE state for ${this.remoteUserId}:`, s);
      if (s === 'failed' || s === 'disconnected') {
        usePeerStore.getState().setState(this.remoteUserId, 'failed', `ice ${s}`);
      } else if (s === 'closed') {
        usePeerStore.getState().setState(this.remoteUserId, 'closed');
      }
    };

    pc.ondatachannel = (e) => {
      this.attachDataChannel(e.channel);
    };

    // 8s opening budget; if not 'open' by then, mark failed and let
    // MessageTransport fall back to server.
    this.connectTimer = setTimeout(() => {
      if (this.channel?.readyState !== 'open') {
        usePeerStore.getState().setState(this.remoteUserId, 'failed', 'timeout');
        this.close('connect-timeout');
      }
    }, 8000);
    usePeerStore.getState().setState(this.remoteUserId, 'connecting');
  }

  private attachDataChannel(ch: RTCDataChannel) {
    this.channel = ch;
    ch.binaryType = 'arraybuffer';
    ch.onopen = () => {
      console.log('[p2p] data channel open with', this.remoteUserId);
      usePeerStore.getState().setState(this.remoteUserId, 'open');
      if (this.connectTimer) clearTimeout(this.connectTimer);
    };
    ch.onclose = () => {
      console.log('[p2p] data channel closed with', this.remoteUserId);
      usePeerStore.getState().setState(this.remoteUserId, 'closed');
    };
    ch.onerror = (ev) => {
      console.warn('[p2p] data channel error:', ev);
    };
    ch.onmessage = (ev) => this.handleIncoming(ev.data);
  }

  private handleIncoming(raw: any) {
    try {
      const env: DataChannelEnvelope = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
      if (env.kind === 'message') {
        // Drop straight into the same store the socket path uses.
        useMessageStore.getState().addMessage(env.payload);
      }
    } catch (err) {
      console.warn('[p2p] failed to parse incoming envelope:', err);
    }
  }

  // ─── Signaling intake (called from useSocket on relayed events) ────

  async onRemoteOffer(sdp: RTCSessionDescriptionInit) {
    const offerCollision = this.makingOffer || this.pc.signalingState !== 'stable';
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;
    try {
      await this.pc.setRemoteDescription(sdp);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      getSocket()?.emit('webrtc:answer', { to: this.remoteUserId, sdp: this.pc.localDescription! });
    } catch (err) {
      console.error('[p2p] onRemoteOffer error:', err);
    }
  }

  async onRemoteAnswer(sdp: RTCSessionDescriptionInit) {
    try {
      await this.pc.setRemoteDescription(sdp);
    } catch (err) {
      console.error('[p2p] onRemoteAnswer error:', err);
    }
  }

  async onRemoteIce(candidate: RTCIceCandidateInit) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!this.ignoreOffer) console.warn('[p2p] addIceCandidate error:', err);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────

  isOpen(): boolean {
    return this.channel?.readyState === 'open';
  }

  send(payload: Message): boolean {
    if (!this.isOpen()) return false;
    this.channel!.send(JSON.stringify({ kind: 'message', payload } satisfies DataChannelEnvelope));
    return true;
  }

  close(reason?: string) {
    try {
      getSocket()?.emit('webrtc:close', { to: this.remoteUserId, reason });
    } catch { /* ignore */ }
    try { this.channel?.close(); } catch { /* ignore */ }
    try { this.pc.close(); } catch { /* ignore */ }
    if (this.connectTimer) clearTimeout(this.connectTimer);
    usePeerStore.getState().setState(this.remoteUserId, 'closed');
  }
}

// ─── Singleton registry ────────────────────────────────────────────

const peers = new Map<string, PeerConnection>();
let myUserId: string | null = null;

export function setLocalUserId(id: string | null) {
  myUserId = id;
}

export function getPeer(userId: string): PeerConnection | undefined {
  return peers.get(userId);
}

export function ensurePeer(userId: string): PeerConnection {
  let p = peers.get(userId);
  if (p) return p;
  if (!myUserId) throw new Error('p2p: local user id not set');
  p = new PeerConnection(myUserId, userId);
  peers.set(userId, p);
  return p;
}

export function dropPeer(userId: string, reason?: string) {
  const p = peers.get(userId);
  if (!p) return;
  p.close(reason);
  peers.delete(userId);
  usePeerStore.getState().remove(userId);
}

export function dropAllPeers() {
  for (const id of Array.from(peers.keys())) dropPeer(id, 'logout');
}
