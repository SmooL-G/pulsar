import { useCallStore, type CallKind, type CallPeer } from '../store/callStore';
import { useAuthStore } from '../store/authStore';
import { ensurePeer, dropPeer, getPeer } from './PeerConnection';
import { getSocket } from '../hooks/useSocket';
import { api } from '../services/api';

/**
 * Bridges the call lifecycle: ties Zustand `callStore` ↔ socket events
 * ↔ PeerConnection media handling. UI components only touch callStore;
 * the socket+peer plumbing lives here.
 *
 * Lifecycle (caller side):
 *   startCall() →
 *     getUserMedia → ensurePeer → addLocalStream (triggers SDP renegotiation
 *     via existing webrtc:* relay) → emit 'call:invite' → phase='outgoing'
 *   on 'call:accepted' → markActive() (peer already negotiating media)
 *   on 'call:rejected' / 'call:unavailable' / 'call:ended' → cleanup
 *
 * Lifecycle (callee side):
 *   on 'call:incoming' → setCall({phase: 'incoming'})  (ringtone plays)
 *   accept() →
 *     getUserMedia → ensurePeer → addLocalStream → emit 'call:accept'
 *     → markActive()
 *   reject() → emit 'call:reject' → reset
 *
 * Auto-end:
 *   on PeerConnection failure or ICE 'disconnected' for >5s → endCall()
 */

let activePeerUserId: string | null = null;
let ringtoneEl: HTMLAudioElement | null = null;

function newCallId(): string {
  // Short opaque id — collision risk negligible at human scale.
  return Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 6);
}

function playRingtone(loop = true) {
  try {
    if (ringtoneEl) return;
    ringtoneEl = new Audio('/sounds/ringtone.mp3');
    ringtoneEl.loop = loop;
    ringtoneEl.volume = 0.6;
    void ringtoneEl.play().catch(() => { /* autoplay blocked, silently fail */ });
  } catch { /* ignore */ }
}

function stopRingtone() {
  try {
    ringtoneEl?.pause();
    ringtoneEl = null;
  } catch { /* ignore */ }
}

async function getUserMediaSafe(kind: CallKind): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video',
    });
  } catch (e) {
    console.warn('[call] getUserMedia denied:', e);
    return null;
  }
}

function attachMediaToPeer(remoteUserId: string, stream: MediaStream) {
  const peer = ensurePeer(remoteUserId);
  peer.onRemoteStream = (s) => {
    useCallStore.getState().setRemoteStream(s);
  };
  // If a remote stream already arrived (race with onRemoteStream wiring), pick it up.
  const existing = peer.getRemoteStream();
  if (existing) useCallStore.getState().setRemoteStream(existing);
  peer.addLocalStream(stream);
}

/** Fetch minimal peer profile (username, displayName, avatar) for the
 *  call UI. Cached only inside this call — re-fetched per invite. */
async function loadPeer(userId: string): Promise<CallPeer> {
  try {
    const { data } = await api.get(`/users/${userId}`);
    return {
      userId,
      username: data.username || 'user',
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    };
  } catch {
    return { userId, username: 'user' };
  }
}

// ─── Public API (called by UI) ─────────────────────────────────────

export async function startCall(peerUserId: string, kind: CallKind) {
  const store = useCallStore.getState();
  if (store.phase !== 'idle') {
    console.warn('[call] startCall while non-idle:', store.phase);
    return;
  }
  const me = useAuthStore.getState().user;
  if (!me || me.id === peerUserId) return;

  const stream = await getUserMediaSafe(kind);
  if (!stream) {
    alert('Не удалось получить доступ к микрофону / камере');
    return;
  }

  const callId = newCallId();
  const peer = await loadPeer(peerUserId);
  store.setCall({ callId, kind, peer, phase: 'outgoing' });
  useCallStore.getState().setLocalStream(stream);
  activePeerUserId = peerUserId;

  attachMediaToPeer(peerUserId, stream);

  getSocket()?.emit('call:invite', { to: peerUserId, callId, kind });
  playRingtone(true);
}

export async function acceptCall() {
  const store = useCallStore.getState();
  if (store.phase !== 'incoming' || !store.peer || !store.callId) return;

  const stream = await getUserMediaSafe(store.kind);
  if (!stream) {
    alert('Не удалось получить доступ к микрофону / камере');
    rejectCall();
    return;
  }

  useCallStore.getState().setLocalStream(stream);
  activePeerUserId = store.peer.userId;
  attachMediaToPeer(store.peer.userId, stream);

  getSocket()?.emit('call:accept', { to: store.peer.userId, callId: store.callId });
  stopRingtone();
  useCallStore.getState().markActive();
}

export function rejectCall(reason: 'declined' | 'busy' = 'declined') {
  const store = useCallStore.getState();
  if (!store.peer || !store.callId) {
    cleanupAndReset();
    return;
  }
  getSocket()?.emit('call:reject', { to: store.peer.userId, callId: store.callId, reason });
  cleanupAndReset();
}

export function cancelCall() {
  const store = useCallStore.getState();
  if (!store.peer || !store.callId) {
    cleanupAndReset();
    return;
  }
  getSocket()?.emit('call:cancel', { to: store.peer.userId, callId: store.callId });
  cleanupAndReset();
}

export function endCall() {
  const store = useCallStore.getState();
  if (!store.peer || !store.callId) {
    cleanupAndReset();
    return;
  }
  const duration = store.startedAt ? Math.round((Date.now() - store.startedAt) / 1000) : 0;
  getSocket()?.emit('call:end', { to: store.peer.userId, callId: store.callId, duration });
  cleanupAndReset('hangup');
}

export function toggleMute() {
  const store = useCallStore.getState();
  if (!store.peer) return;
  const newMuted = !store.isMuted;
  const peer = getPeer(store.peer.userId);
  peer?.setAudioMuted(newMuted);
  useCallStore.getState().setMuted(newMuted);
}

export function toggleVideo() {
  const store = useCallStore.getState();
  if (!store.peer) return;
  const newMuted = !store.isVideoMuted;
  const peer = getPeer(store.peer.userId);
  peer?.setVideoMuted(newMuted);
  useCallStore.getState().setVideoMuted(newMuted);
}

// ─── Internal cleanup ──────────────────────────────────────────────

function cleanupAndReset(endReason?: 'hangup' | 'rejected' | 'cancelled' | 'unavailable' | 'missed') {
  stopRingtone();
  const peerUserId = activePeerUserId;
  activePeerUserId = null;
  const store = useCallStore.getState();
  const localStream = store.localStream;

  if (localStream) {
    try { localStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
  }

  // We keep the PeerConnection itself — it might still have the data
  // channel open for chat. Just drop the media tracks.
  if (peerUserId) {
    const peer = getPeer(peerUserId);
    try { peer?.removeLocalStream(); } catch { /* ignore */ }
    if (peer) peer.onRemoteStream = null;
  }

  if (endReason) {
    store.endCall(endReason);
    // Show "Ended" splash briefly, then reset.
    setTimeout(() => useCallStore.getState().reset(), 1500);
  } else {
    store.reset();
  }
}

// ─── Socket event registration ─────────────────────────────────────

let registered = false;

export function registerCallSocketHandlers() {
  if (registered) return;
  const socket = getSocket();
  if (!socket) return;
  registered = true;

  socket.on('call:incoming', async ({ from, callId, kind }) => {
    const store = useCallStore.getState();
    if (store.phase !== 'idle') {
      // Busy — auto-reject the new invite so the caller gets feedback.
      socket.emit('call:reject', { to: from, callId, reason: 'busy' });
      return;
    }
    const peer = await loadPeer(from);
    store.setCall({ callId, kind, peer, phase: 'incoming' });
    playRingtone(true);
  });

  socket.on('call:ringing', () => {
    // Caller-side confirmation — nothing to update visually.
  });

  socket.on('call:unavailable', ({ reason }) => {
    const store = useCallStore.getState();
    if (store.phase !== 'outgoing') return;
    cleanupAndReset(reason === 'busy' ? 'rejected' : 'unavailable');
  });

  socket.on('call:accepted', () => {
    const store = useCallStore.getState();
    if (store.phase !== 'outgoing') return;
    stopRingtone();
    store.markActive();
  });

  socket.on('call:rejected', () => {
    cleanupAndReset('rejected');
  });

  socket.on('call:cancelled', () => {
    cleanupAndReset('cancelled');
  });

  socket.on('call:ended', () => {
    cleanupAndReset('hangup');
  });
}
