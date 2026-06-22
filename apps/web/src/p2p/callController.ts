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
let outgoingTimeout: ReturnType<typeof setTimeout> | null = null;

/** Hard ceiling on how long we wait for the callee to pick up before
 *  auto-cancelling. Prevents the UI from sticking in 'outgoing' forever
 *  if the callee drops their socket mid-ring. */
const OUTGOING_TIMEOUT_MS = 45_000;

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

/** Show an OS-level notification for an incoming call. We only fire
 *  this when the page is hidden — if it's visible, the in-app
 *  CallOverlay is already obvious and a second toast would be noise.
 *  Tapping the notification focuses the tab so the user can accept. */
let activeNotification: Notification | null = null;
function showIncomingCallNotification(callerName: string, kind: CallKind) {
  try {
    if (typeof Notification === 'undefined') return;
    if (document.visibilityState === 'visible') return;

    const fire = () => {
      try {
        activeNotification?.close();
        activeNotification = new Notification(
          kind === 'video' ? `📹 Видеозвонок` : `📞 Звонок`,
          {
            body: callerName,
            tag: 'pulsar-call',
            requireInteraction: true,
            silent: false,
          },
        );
        activeNotification.onclick = () => {
          window.focus();
          activeNotification?.close();
          activeNotification = null;
        };
      } catch (e) {
        console.warn('[call] notification failed:', e);
      }
    };

    if (Notification.permission === 'granted') {
      fire();
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then((p) => { if (p === 'granted') fire(); });
    }
  } catch { /* notifications unsupported */ }
}

function closeIncomingCallNotification() {
  try { activeNotification?.close(); activeNotification = null; } catch {}
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
  console.log('[call] attachMediaToPeer', {
    remoteUserId,
    existingRemote: !!peer.getRemoteStream(),
    localTracks: stream.getTracks().length,
  });
  peer.onRemoteStream = (s) => {
    console.log('[call] onRemoteStream fired (1-to-1)', { remoteUserId, tracks: s.getTracks().length });
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
  console.log('[call] startCall', { peerUserId, kind, phase: useCallStore.getState().phase });
  const store = useCallStore.getState();

  // If the store is stuck in a non-idle phase (e.g. previous call's
  // socket reply got lost), reset and proceed instead of silently
  // ignoring the click — the user is explicitly asking for a new call.
  if (store.phase !== 'idle') {
    console.warn('[call] resetting stale phase before new call:', store.phase);
    cleanupAndReset();
  }

  // Voice room and 1-to-1 calls share the same PeerConnection registry
  // (ensurePeer). If a voice room is active it will have written its
  // own onRemoteStream callback into our peer object — we'd never see
  // remote tracks routed to the call UI. Tear it down first.
  try {
    const { useVoiceRoomStore } = await import('../store/voiceRoomStore');
    if (useVoiceRoomStore.getState().activeChatId) {
      console.warn('[call] leaving voice room before 1-to-1 call');
      const { leaveVoiceRoom } = await import('./voiceRoomController');
      await leaveVoiceRoom();
    }
  } catch { /* voiceRoom modules optional */ }

  const me = useAuthStore.getState().user;
  if (!me || me.id === peerUserId) return;

  const socket = getSocket();
  if (!socket?.connected) {
    alert('Нет соединения с сервером. Перезагрузите страницу.');
    return;
  }

  const stream = await getUserMediaSafe(kind);
  if (!stream) {
    alert('Не удалось получить доступ к микрофону / камере');
    return;
  }

  const callId = newCallId();
  const peer = await loadPeer(peerUserId);
  useCallStore.getState().setCall({ callId, kind, peer, phase: 'outgoing' });
  useCallStore.getState().setLocalStream(stream);
  activePeerUserId = peerUserId;

  attachMediaToPeer(peerUserId, stream);

  socket.emit('call:invite', { to: peerUserId, callId, kind });
  console.log('[call] emitted call:invite', { to: peerUserId, callId });
  playRingtone(true);

  // Safety timer: if no reply within 45s, auto-cancel.
  if (outgoingTimeout) clearTimeout(outgoingTimeout);
  outgoingTimeout = setTimeout(() => {
    const s = useCallStore.getState();
    if (s.phase === 'outgoing' && s.callId === callId) {
      console.warn('[call] outgoing timeout, auto-cancel');
      cancelCall();
    }
  }, OUTGOING_TIMEOUT_MS);
}

export async function acceptCall() {
  const store = useCallStore.getState();
  if (store.phase !== 'incoming' || !store.peer || !store.callId) return;

  // Same defensive cleanup as startCall — voice room may have stolen
  // the PeerConnection's onRemoteStream slot.
  try {
    const { useVoiceRoomStore } = await import('../store/voiceRoomStore');
    if (useVoiceRoomStore.getState().activeChatId) {
      console.warn('[call] leaving voice room before accepting 1-to-1 call');
      const { leaveVoiceRoom } = await import('./voiceRoomController');
      await leaveVoiceRoom();
    }
  } catch { /* voiceRoom modules optional */ }

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
  closeIncomingCallNotification();
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

/** Swap the microphone for this call to a different input device.
 *  Replaces the audio sender's track in-place — no renegotiation
 *  needed, the other side keeps receiving without interruption. */
export async function switchInputDevice(deviceId: string) {
  const store = useCallStore.getState();
  if (!store.peer || !store.localStream) return;

  console.log('[call] switchInputDevice', deviceId);
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      video: store.kind === 'video' ? (store.localStream.getVideoTracks()[0] ? true : false) : false,
    });

    const peer = getPeer(store.peer.userId);
    if (!peer) return;

    // Replace the AUDIO sender's track without touching video (video
    // track is unchanged — we just took a fresh audio track).
    const newAudio = newStream.getAudioTracks()[0];
    if (newAudio) {
      const replaced = await peer.replaceTrack('audio', newAudio);
      if (!replaced) {
        console.warn('[call] could not replace audio track');
        newAudio.stop();
        return;
      }
    }

    // Stop old audio tracks from localStream; keep video tracks.
    for (const t of store.localStream.getAudioTracks()) t.stop();

    // Build a NEW MediaStream containing the new audio + existing video
    // so the local-preview useEffect in CallOverlay re-binds cleanly.
    const updated = new MediaStream();
    if (newAudio) updated.addTrack(newAudio);
    for (const v of store.localStream.getVideoTracks()) updated.addTrack(v);

    useCallStore.getState().setLocalStream(updated);
    useCallStore.getState().setInputDeviceId(deviceId);
  } catch (e) {
    console.warn('[call] switchInputDevice failed:', e);
  }
}

/** Switch the speaker/headset that incoming audio plays from. Uses
 *  HTMLMediaElement.setSinkId — supported in Chrome/Edge/Opera; in
 *  Firefox and iOS Safari this is a no-op and the OS picks the
 *  active output. */
export async function switchOutputDevice(deviceId: string) {
  console.log('[call] switchOutputDevice', deviceId);
  useCallStore.getState().setOutputDeviceId(deviceId);
  // CallOverlay's useEffect picks up outputDeviceId and calls
  // setSinkId on the audio element.
}

// ─── Internal cleanup ──────────────────────────────────────────────

function cleanupAndReset(endReason?: 'hangup' | 'rejected' | 'cancelled' | 'unavailable' | 'missed') {
  stopRingtone();
  closeIncomingCallNotification();
  if (outgoingTimeout) { clearTimeout(outgoingTimeout); outgoingTimeout = null; }
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

/** Pass the live socket explicitly so we wire onto THIS instance.
 *  Safe to call multiple times — we off() before on() each time. */
export function registerCallSocketHandlers(socket: any) {
  if (!socket) {
    console.warn('[call] registerCallSocketHandlers: no socket');
    return;
  }

  socket.off('call:incoming');
  socket.off('call:ringing');
  socket.off('call:unavailable');
  socket.off('call:accepted');
  socket.off('call:rejected');
  socket.off('call:cancelled');
  socket.off('call:ended');

  socket.on('call:incoming', async ({ from, callId, kind }: { from: string; callId: string; kind: CallKind }) => {
    console.log('[call] incoming', { from, callId, kind });
    const store = useCallStore.getState();
    if (store.phase !== 'idle') {
      socket.emit('call:reject', { to: from, callId, reason: 'busy' });
      return;
    }
    const peer = await loadPeer(from);
    store.setCall({ callId, kind, peer, phase: 'incoming' });
    playRingtone(true);
    showIncomingCallNotification(peer.displayName || peer.username, kind);
  });

  socket.on('call:ringing', ({ callId }: { callId: string }) => {
    console.log('[call] ringing', callId);
  });

  socket.on('call:unavailable', ({ callId, reason }: { callId: string; reason: 'offline' | 'busy' }) => {
    console.log('[call] unavailable', { callId, reason });
    const store = useCallStore.getState();
    if (store.phase !== 'outgoing') return;
    cleanupAndReset(reason === 'busy' ? 'rejected' : 'unavailable');
  });

  socket.on('call:accepted', ({ callId }: { callId: string }) => {
    console.log('[call] accepted', callId);
    const store = useCallStore.getState();
    if (store.phase !== 'outgoing') return;
    stopRingtone();
    store.markActive();
  });

  socket.on('call:rejected', ({ callId }: { callId: string }) => {
    console.log('[call] rejected', callId);
    cleanupAndReset('rejected');
  });

  socket.on('call:cancelled', ({ callId }: { callId: string }) => {
    console.log('[call] cancelled', callId);
    cleanupAndReset('cancelled');
  });

  socket.on('call:ended', ({ callId, duration }: { callId: string; duration: number }) => {
    console.log('[call] ended', { callId, duration });
    cleanupAndReset('hangup');
  });
}

/** Force-reset the call store to idle. Exposed for the dead-call
 *  recovery: if the user clicks the call button while the store is
 *  somehow stuck non-idle (lost socket reply, etc.), we wipe state
 *  before starting a fresh call. */
export function forceResetCallState() {
  console.log('[call] forceResetCallState');
  cleanupAndReset();
}
