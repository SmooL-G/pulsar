import { ICE_SERVERS, getIceServers } from './iceServers';
import { usePeerStore } from './peerStore';
import { getSocket } from '../hooks/useSocket';
import { useMessageStore } from '../store/messageStore';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { relayClient } from './RelayClient';
import type { Message } from '@pulsar/shared';

/**
 * Send a signaling event. Prefers a connected public relay (Phase 2);
 * falls back to the legacy Socket.IO server path. Both wire formats
 * are identical so the receiver dedupes naturally — they handle the
 * first one that arrives and the second is a no-op (signalingState
 * mismatch is silently caught in the on-handlers).
 */
function emitSignaling(
  event: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice' | 'webrtc:close',
  to: string,
  body: any,
) {
  const payload = { kind: event, ...body };
  if (relayClient.isReady()) {
    relayClient.publish(to, payload);
    return;
  }
  // Server-socket fallback. Whatever the relay couldn't deliver still
  // has a chance via our central server (Phase 1 path).
  getSocket()?.emit(event, { to, ...body });
}

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

  // Media (calls). Empty until addLocalStream() is called.
  private localStream: MediaStream | null = null;
  private localSenders: RTCRtpSender[] = [];
  private remoteStream: MediaStream | null = null;
  /** Called once when the first remote track arrives so the UI can
   *  bind the stream to an <audio>/<video> element. Idempotent — we
   *  keep adding tracks to the same MediaStream so subsequent calls
   *  receive the *same* reference. */
  public onRemoteStream: ((stream: MediaStream) => void) | null = null;

  constructor(localUserId: string, remoteUserId: string) {
    this.localUserId = localUserId;
    this.remoteUserId = remoteUserId;
    this.polite = localUserId > remoteUserId;
    // Bootstrap with STUN-only so the constructor stays sync; swap in
    // TURN credentials as soon as they arrive (setConfiguration is
    // safe before the first negotiation completes).
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    getIceServers().then((servers) => {
      try {
        this.pc.setConfiguration({ iceServers: servers });
      } catch { /* connection may already be in stable state, ok */ }
    }).catch(() => { /* TURN unavailable, STUN-only is fine */ });

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

    // Negotiation: fires when something changes that needs a renegotiation.
    pc.onnegotiationneeded = async () => {
      console.log(`[p2p] negotiationneeded for ${this.remoteUserId} (state: ${pc.signalingState})`);
      try {
        this.makingOffer = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log(`[p2p] sending offer to ${this.remoteUserId}`);
        emitSignaling('webrtc:offer', this.remoteUserId, { sdp: pc.localDescription! });
      } catch (err) {
        console.error('[p2p] negotiationneeded error:', err);
      } finally {
        this.makingOffer = false;
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        emitSignaling('webrtc:ice', this.remoteUserId, { candidate: e.candidate.toJSON() });
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

    pc.ontrack = (e) => {
      console.log(`[p2p] ontrack from ${this.remoteUserId}: kind=${e.track.kind} id=${e.track.id} streams=${e.streams.length}`);
      if (!this.remoteStream) this.remoteStream = new MediaStream();
      this.remoteStream.addTrack(e.track);
      try {
        if (this.onRemoteStream) {
          console.log(`[p2p] firing onRemoteStream callback for ${this.remoteUserId}`);
          this.onRemoteStream(this.remoteStream);
        } else {
          console.log(`[p2p] onRemoteStream callback NOT YET SET for ${this.remoteUserId} (will be picked up on accept)`);
        }
      } catch (err) {
        console.warn('[p2p] onRemoteStream handler threw:', err);
      }
    };

    // 8s opening budget for the data channel. If it doesn't open by
    // then we mark the peer 'failed' so MessageTransport falls back to
    // the server, but we DON'T close() the PeerConnection — that would
    // emit webrtc:close, dropping the other side's PC (including any
    // media tracks added for an in-progress call). The PC stays alive;
    // either later media negotiation succeeds or an explicit hang-up
    // tears it down.
    this.connectTimer = setTimeout(() => {
      if (this.channel?.readyState !== 'open') {
        usePeerStore.getState().setState(this.remoteUserId, 'failed', 'timeout');
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
    if (this.pc.signalingState === 'closed') return; // stale handler post-teardown
    const offerCollision = this.makingOffer || this.pc.signalingState !== 'stable';
    this.ignoreOffer = !this.polite && offerCollision;
    console.log(`[p2p] onRemoteOffer from ${this.remoteUserId} (state: ${this.pc.signalingState}, polite: ${this.polite}, collision: ${offerCollision}, ignore: ${this.ignoreOffer})`);
    if (this.ignoreOffer) {
      console.warn(`[p2p] IGNORING offer from ${this.remoteUserId} due to collision`);
      return;
    }
    try {
      // Perfect-negotiation rollback for the polite peer: if we have a
      // pending local offer when a remote one arrives, rollback ours
      // BEFORE applying theirs, otherwise setRemoteDescription throws
      // InvalidStateError and the negotiation deadlocks.
      if (offerCollision && this.polite) {
        console.log(`[p2p] polite rollback before remote offer`);
        await Promise.all([
          this.pc.setLocalDescription({ type: 'rollback' } as any),
          this.pc.setRemoteDescription(sdp),
        ]);
      } else {
        await this.pc.setRemoteDescription(sdp);
      }
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      console.log(`[p2p] sending answer to ${this.remoteUserId}`);
      emitSignaling('webrtc:answer', this.remoteUserId, { sdp: this.pc.localDescription! });
    } catch (err) {
      // Don't log if the connection was torn down between checks.
      if (this.pc.signalingState !== 'closed') {
        console.error('[p2p] onRemoteOffer error:', err);
      }
    }
  }

  async onRemoteAnswer(sdp: RTCSessionDescriptionInit) {
    if (this.pc.signalingState === 'closed') return;
    console.log(`[p2p] onRemoteAnswer from ${this.remoteUserId} (state: ${this.pc.signalingState})`);
    try {
      await this.pc.setRemoteDescription(sdp);
    } catch (err) {
      if (this.pc.signalingState !== 'closed') {
        console.error('[p2p] onRemoteAnswer error:', err);
      }
    }
  }

  async onRemoteIce(candidate: RTCIceCandidateInit) {
    if (this.pc.signalingState === 'closed') return;
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!this.ignoreOffer && this.pc.signalingState !== 'closed') {
        console.warn('[p2p] addIceCandidate error:', err);
      }
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

  // ─── Media (calls) ────────────────────────────────────────────────

  /** Attach a local media stream. Fires onnegotiationneeded which
   *  triggers a renegotiation through the existing offer/answer path,
   *  so the remote side starts receiving tracks automatically. */
  addLocalStream(stream: MediaStream) {
    console.log(`[p2p] addLocalStream to ${this.remoteUserId}: ${stream.getTracks().length} tracks (state: ${this.pc.signalingState})`);
    this.localStream = stream;
    for (const track of stream.getTracks()) {
      console.log(`[p2p]   adding ${track.kind} track id=${track.id} enabled=${track.enabled}`);
      const sender = this.pc.addTrack(track, stream);
      this.localSenders.push(sender);
    }
    // Don't trust onnegotiationneeded to fire reliably across browser
    // versions / WebRTC adapter quirks. Kick off renegotiation
    // explicitly. If signaling is busy, schedule for when it's stable.
    void this.renegotiate('addLocalStream');
  }

  private async renegotiate(reason: string) {
    if (this.pc.signalingState === 'closed') return;
    if (this.pc.signalingState !== 'stable') {
      console.log(`[p2p] renegotiate(${reason}) deferred — state ${this.pc.signalingState}`);
      // Try again on next stable state. signalingstatechange covers it.
      const onStable = () => {
        if (this.pc.signalingState === 'stable') {
          this.pc.removeEventListener('signalingstatechange', onStable);
          void this.renegotiate(reason + ':deferred');
        }
      };
      this.pc.addEventListener('signalingstatechange', onStable);
      return;
    }
    if (this.makingOffer) return;
    try {
      this.makingOffer = true;
      console.log(`[p2p] explicit renegotiate(${reason}) for ${this.remoteUserId}`);
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      console.log(`[p2p] sending offer to ${this.remoteUserId} (explicit)`);
      emitSignaling('webrtc:offer', this.remoteUserId, { sdp: this.pc.localDescription! });
    } catch (err) {
      console.error(`[p2p] renegotiate(${reason}) failed:`, err);
    } finally {
      this.makingOffer = false;
    }
  }

  removeLocalStream() {
    for (const sender of this.localSenders) {
      try { this.pc.removeTrack(sender); } catch { /* ignore */ }
    }
    this.localSenders = [];
    if (this.localStream) {
      try { this.localStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      this.localStream = null;
    }
  }

  setAudioMuted(muted: boolean) {
    if (!this.localStream) return;
    for (const track of this.localStream.getAudioTracks()) track.enabled = !muted;
  }

  /** Swap the track for an existing RTCRtpSender of the matching kind.
   *  Used to hot-switch microphone/camera mid-call without
   *  renegotiation. Returns true on success, false if no sender was
   *  found for that kind. */
  async replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack): Promise<boolean> {
    const sender = this.localSenders.find((s) => s.track?.kind === kind);
    if (!sender) {
      console.warn(`[p2p] no ${kind} sender to replace`);
      return false;
    }
    try {
      const old = sender.track;
      await sender.replaceTrack(newTrack);
      if (old && old !== newTrack) old.stop();
      return true;
    } catch (e) {
      console.error('[p2p] replaceTrack failed:', e);
      return false;
    }
  }

  setVideoMuted(muted: boolean) {
    if (!this.localStream) return;
    for (const track of this.localStream.getVideoTracks()) track.enabled = !muted;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  close(reason?: string) {
    try {
      emitSignaling('webrtc:close', this.remoteUserId, { reason });
    } catch { /* ignore */ }
    try { this.removeLocalStream(); } catch { /* ignore */ }
    try { this.channel?.close(); } catch { /* ignore */ }
    try { this.pc.close(); } catch { /* ignore */ }
    if (this.connectTimer) clearTimeout(this.connectTimer);
    usePeerStore.getState().setState(this.remoteUserId, 'closed');
  }
}

// ─── Singleton registry ────────────────────────────────────────────

const peers = new Map<string, PeerConnection>();
let myUserId: string | null = null;

// Keep `myUserId` in sync with authStore. Boot-time `isAuthenticated` is
// derived from localStorage *before* the /auth/me fetch resolves, so a
// one-shot setLocalUserId() at socket-connect time would still see null.
// The subscription means we get the id the moment user loads, regardless
// of who reads it first (sender or receiver of an offer).
useAuthStore.subscribe((s) => {
  const id = s.user?.id ?? null;
  myUserId = id;
  if (id) relayClient.start(id); else relayClient.stop();
});
// Initialize from current state in case user was already loaded.
myUserId = useAuthStore.getState().user?.id ?? null;
if (myUserId) relayClient.start(myUserId);

// Dispatch packets that arrive over the relay back into the same
// per-event handlers Socket.IO uses. Set up once at module load; the
// closure captures the registry above.
relayClient.onPacket(async (from, payload) => {
  if (!payload || typeof payload.kind !== 'string') return;
  try {
    if (payload.kind === 'webrtc:offer') {
      await ensurePeer(from).onRemoteOffer(payload.sdp);
    } else if (payload.kind === 'webrtc:answer') {
      const peer = peers.get(from);
      if (peer) await peer.onRemoteAnswer(payload.sdp);
    } else if (payload.kind === 'webrtc:ice') {
      const peer = peers.get(from);
      if (peer) await peer.onRemoteIce(payload.candidate);
    } else if (payload.kind === 'webrtc:close') {
      dropPeer(from, payload.reason);
    }
  } catch (err) {
    console.warn('[relay] packet handler failed:', err);
  }
});

export function setLocalUserId(id: string | null) {
  // Kept for back-compat with useSocket; no longer authoritative.
  if (id) myUserId = id;
}

export function getPeer(userId: string): PeerConnection | undefined {
  return peers.get(userId);
}

export function ensurePeer(userId: string): PeerConnection {
  let p = peers.get(userId);
  if (p) return p;
  // Last-ditch attempt to grab id (e.g. on first click before subscription fires).
  if (!myUserId) myUserId = useAuthStore.getState().user?.id ?? null;
  if (!myUserId) {
    console.error('[p2p] ensurePeer called before user is loaded');
    throw new Error('p2p: local user id not set');
  }
  console.log('[p2p] creating connection', { from: myUserId, to: userId });
  p = new PeerConnection(myUserId, userId);
  peers.set(userId, p);
  return p;
}

export function dropPeer(userId: string, reason?: string) {
  // Never tear down the PC while a call is active with this user.
  // Defensive against old-version clients still emitting webrtc:close
  // on their data-channel timeout — that would kill our media tracks
  // mid-call. Explicit endCall() handles cleanup; this is purely a
  // peer-state event.
  const callState = useCallStore.getState();
  const inCallWithThisUser =
    callState.phase !== 'idle' && callState.phase !== 'ended' &&
    callState.peer?.userId === userId;
  if (inCallWithThisUser) {
    console.log(`[p2p] suppressing dropPeer(${userId}) — active call (reason: ${reason})`);
    return;
  }
  const p = peers.get(userId);
  if (!p) return;
  p.close(reason);
  peers.delete(userId);
  usePeerStore.getState().remove(userId);
}

export function dropAllPeers() {
  for (const id of Array.from(peers.keys())) dropPeer(id, 'logout');
}
