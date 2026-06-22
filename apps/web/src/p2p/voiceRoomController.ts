import { useVoiceRoomStore, type VoiceRoomParticipant } from '../store/voiceRoomStore';
import { useAuthStore } from '../store/authStore';
import { ensurePeer, getPeer, dropPeer } from './PeerConnection';
import { getSocket } from '../hooks/useSocket';
import { api } from '../services/api';

/**
 * Multi-peer mesh orchestration for group voice rooms. Wraps the
 * existing 1-to-1 PeerConnection class — for each other participant
 * we use ensurePeer(userId).addLocalStream(...), exactly like a
 * direct call. The only thing that changes is bookkeeping: we keep
 * track of which PCs belong to this room so leaving cleans them up.
 *
 * Active-speaker detection lives in `useActiveSpeaker` hook — this
 * file just plumbs streams to the store.
 */

let activeRoomPeers = new Set<string>(); // userIds we created PCs for
let activeRoomChatId: string | null = null;

function newAudioContext(): AudioContext | null {
  try {
    return new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch { return null; }
}

let analyserCtx: AudioContext | null = null;
const analysers = new Map<string, { source: MediaStreamAudioSourceNode; node: AnalyserNode }>();
let speakingPollTimer: ReturnType<typeof setInterval> | null = null;

const SPEAKING_THRESHOLD = 0.025;   // RMS — empirical
const SPEAKING_POLL_HZ = 10;        // checks per second

function attachAnalyser(userId: string, stream: MediaStream) {
  if (!analyserCtx) analyserCtx = newAudioContext();
  if (!analyserCtx) return;
  if (analysers.has(userId)) return;
  if (stream.getAudioTracks().length === 0) return;
  try {
    const source = analyserCtx.createMediaStreamSource(stream);
    const node = analyserCtx.createAnalyser();
    node.fftSize = 1024;
    source.connect(node);
    analysers.set(userId, { source, node });
    if (!speakingPollTimer) {
      speakingPollTimer = setInterval(pollSpeaking, Math.round(1000 / SPEAKING_POLL_HZ));
    }
  } catch (e) {
    console.warn('[voiceRoom] analyser attach failed:', e);
  }
}

function detachAnalyser(userId: string) {
  const a = analysers.get(userId);
  if (!a) return;
  try { a.source.disconnect(); } catch { /* ignore */ }
  analysers.delete(userId);
  if (analysers.size === 0 && speakingPollTimer) {
    clearInterval(speakingPollTimer);
    speakingPollTimer = null;
  }
}

function pollSpeaking() {
  const store = useVoiceRoomStore.getState();
  const buf = new Float32Array(1024);
  for (const [userId, a] of analysers) {
    a.node.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    const isSpeaking = rms > SPEAKING_THRESHOLD;
    const cur = store.participants.get(userId);
    if (cur && cur.isSpeaking !== isSpeaking) {
      store.updateParticipant(userId, { isSpeaking });
    }
  }
}

async function loadProfile(userId: string): Promise<VoiceRoomParticipant['profile']> {
  try {
    const { data } = await api.get(`/users/${userId}`);
    return {
      username: data.username,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
    };
  } catch {
    return { username: 'user' };
  }
}

async function getLocalAudioStream(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    console.warn('[voiceRoom] mic permission denied:', e);
    return null;
  }
}

function attachStreamToPeer(remoteUserId: string, stream: MediaStream) {
  const peer = ensurePeer(remoteUserId);
  // Subscribe to remote tracks → store them in voiceRoomStore + attach
  // an analyser for active-speaker detection.
  peer.onRemoteStream = (remote) => {
    useVoiceRoomStore.getState().updateParticipant(remoteUserId, { stream: remote });
    attachAnalyser(remoteUserId, remote);
  };
  const existing = peer.getRemoteStream();
  if (existing) {
    useVoiceRoomStore.getState().updateParticipant(remoteUserId, { stream: existing });
    attachAnalyser(remoteUserId, existing);
  }
  peer.addLocalStream(stream);
  activeRoomPeers.add(remoteUserId);
}

// ─── Public API ────────────────────────────────────────────────────

export async function joinVoiceRoom(chatId: string) {
  const store = useVoiceRoomStore.getState();
  // Already in this room? No-op.
  if (store.activeChatId === chatId && store.localStream) return;
  // In another room? Leave first.
  if (store.activeChatId && store.activeChatId !== chatId) {
    await leaveVoiceRoom();
  }

  const stream = await getLocalAudioStream();
  if (!stream) {
    alert('Не удалось получить доступ к микрофону');
    return;
  }

  store.setActive(chatId);
  store.setLocalStream(stream);
  activeRoomChatId = chatId;

  const socket = getSocket();
  if (!socket?.connected) {
    alert('Нет соединения с сервером');
    return;
  }
  socket.emit('voiceRoom:join', { chatId });
}

export async function leaveVoiceRoom() {
  const store = useVoiceRoomStore.getState();
  const chatId = store.activeChatId;
  if (!chatId) return;

  getSocket()?.emit('voiceRoom:leave', { chatId });

  // Stop our mic + drop media tracks from all PCs (keep PC for chat
  // data channel if it was there before; otherwise drop entirely).
  if (store.localStream) {
    try { store.localStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
  }
  for (const userId of activeRoomPeers) {
    const peer = getPeer(userId);
    try { peer?.removeLocalStream(); } catch { /* ignore */ }
    if (peer) peer.onRemoteStream = null;
    detachAnalyser(userId);
  }
  activeRoomPeers.clear();
  activeRoomChatId = null;
  store.reset();
}

export function toggleMute() {
  const store = useVoiceRoomStore.getState();
  if (!store.localStream || !store.activeChatId) return;
  const newMuted = !store.myMuted;
  for (const t of store.localStream.getAudioTracks()) t.enabled = !newMuted;
  store.setMyMuted(newMuted);
  getSocket()?.emit('voiceRoom:mute', { chatId: store.activeChatId, isMuted: newMuted });
}

export function requestVideo() {
  const store = useVoiceRoomStore.getState();
  if (!store.activeChatId) return;
  getSocket()?.emit('voiceRoom:videoRequest', { chatId: store.activeChatId });
}

export function grantVideo(targetUserId: string, allowed: boolean) {
  const store = useVoiceRoomStore.getState();
  if (!store.activeChatId) return;
  getSocket()?.emit('voiceRoom:videoGrant', {
    chatId: store.activeChatId, targetUserId, allowed,
  });
}

export async function startMyVideo() {
  const store = useVoiceRoomStore.getState();
  const chatId = store.activeChatId;
  if (!chatId || !store.localStream) return;
  const me = store.participants.get(useAuthStore.getState().user?.id || '');
  if (!me?.canStreamVideo) {
    alert('Админ ещё не разрешил видео');
    return;
  }

  try {
    const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = camStream.getVideoTracks()[0];
    if (!videoTrack) return;

    // Add the video track to every existing PC. This triggers
    // renegotiation per peer (perfect-negotiation handles it).
    store.localStream.addTrack(videoTrack);
    for (const userId of activeRoomPeers) {
      const peer = getPeer(userId);
      if (!peer) continue;
      // sender is created on the fly when we add the track to localStream
      // via getUserMedia merge; for PC use addTrack directly.
      try {
        const pcAny = (peer as any).pc as RTCPeerConnection | undefined;
        if (pcAny) {
          const sender = pcAny.addTrack(videoTrack, store.localStream);
          (peer as any).localSenders?.push(sender);
        }
      } catch (e) {
        console.warn('[voiceRoom] addTrack failed for', userId, e);
      }
      // Force renegotiation through PC's explicit path.
      try { await (peer as any).renegotiate?.('voiceRoom:videoStart'); } catch { /* ignore */ }
    }

    store.setMyVideoOn(true);
    getSocket()?.emit('voiceRoom:videoStart', { chatId });
  } catch (e) {
    console.warn('[voiceRoom] startMyVideo failed:', e);
    alert('Не удалось включить камеру');
  }
}

export async function stopMyVideo() {
  const store = useVoiceRoomStore.getState();
  const chatId = store.activeChatId;
  if (!chatId || !store.localStream) return;
  for (const t of store.localStream.getVideoTracks()) {
    try { t.stop(); } catch { /* ignore */ }
    store.localStream.removeTrack(t);
  }
  // Remove video senders from each PC.
  for (const userId of activeRoomPeers) {
    const peer = getPeer(userId);
    if (!peer) continue;
    try {
      const pcAny = (peer as any).pc as RTCPeerConnection | undefined;
      const senders = pcAny?.getSenders().filter((s) => s.track?.kind === 'video') || [];
      for (const s of senders) {
        await s.replaceTrack(null);
      }
    } catch (e) {
      console.warn('[voiceRoom] stopMyVideo replace failed for', userId, e);
    }
  }
  store.setMyVideoOn(false);
  getSocket()?.emit('voiceRoom:videoStop', { chatId });
}

// ─── Socket event registration ─────────────────────────────────────

export function registerVoiceRoomSocketHandlers(socket: any) {
  if (!socket) return;

  socket.off('voiceRoom:participants');
  socket.off('voiceRoom:participantJoined');
  socket.off('voiceRoom:participantLeft');
  socket.off('voiceRoom:participantMuted');
  socket.off('voiceRoom:videoRequest');
  socket.off('voiceRoom:videoGranted');
  socket.off('voiceRoom:videoStarted');
  socket.off('voiceRoom:videoStopped');
  socket.off('voiceRoom:closed');
  socket.off('voiceRoom:error');

  socket.on('voiceRoom:participants', async ({ chatId, participants }: any) => {
    const store = useVoiceRoomStore.getState();
    if (store.activeChatId !== chatId) return;
    const localStream = store.localStream;
    const myId = useAuthStore.getState().user?.id;

    // Load profiles in parallel for all participants.
    const enriched: VoiceRoomParticipant[] = await Promise.all(
      participants.map(async (p: any) => ({
        ...p,
        profile: await loadProfile(p.userId),
      })),
    );
    store.setParticipants(enriched);

    // Initiate mesh — attach our stream to each OTHER participant.
    if (localStream) {
      for (const p of enriched) {
        if (p.userId === myId) continue;
        attachStreamToPeer(p.userId, localStream);
      }
    }
  });

  socket.on('voiceRoom:participantJoined', async ({ chatId, userId }: any) => {
    const store = useVoiceRoomStore.getState();
    if (store.activeChatId !== chatId) return;
    const profile = await loadProfile(userId);
    store.addParticipant({
      userId, isMuted: false, canStreamVideo: false, isStreamingVideo: false,
      joinedAt: Date.now(), profile,
    });
    if (store.localStream && userId !== useAuthStore.getState().user?.id) {
      attachStreamToPeer(userId, store.localStream);
    }
  });

  socket.on('voiceRoom:participantLeft', ({ chatId, userId }: any) => {
    const store = useVoiceRoomStore.getState();
    if (store.activeChatId !== chatId) return;
    store.removeParticipant(userId);
    detachAnalyser(userId);
    const peer = getPeer(userId);
    try { peer?.removeLocalStream(); } catch { /* ignore */ }
    if (peer) peer.onRemoteStream = null;
    activeRoomPeers.delete(userId);
  });

  socket.on('voiceRoom:participantMuted', ({ chatId, userId, isMuted }: any) => {
    const store = useVoiceRoomStore.getState();
    if (store.activeChatId !== chatId) return;
    store.updateParticipant(userId, { isMuted });
  });

  socket.on('voiceRoom:videoRequest', ({ chatId, userId }: any) => {
    const store = useVoiceRoomStore.getState();
    if (store.activeChatId !== chatId) return;
    store.addVideoRequest(userId);
  });

  socket.on('voiceRoom:videoGranted', ({ chatId, userId, allowed }: any) => {
    const store = useVoiceRoomStore.getState();
    if (store.activeChatId !== chatId) return;
    store.updateParticipant(userId, { canStreamVideo: allowed });
    store.removeVideoRequest(userId);
  });

  socket.on('voiceRoom:videoStarted', ({ chatId, userId }: any) => {
    const store = useVoiceRoomStore.getState();
    if (store.activeChatId !== chatId) return;
    store.updateParticipant(userId, { isStreamingVideo: true });
  });

  socket.on('voiceRoom:videoStopped', ({ chatId, userId }: any) => {
    const store = useVoiceRoomStore.getState();
    if (store.activeChatId !== chatId) return;
    store.updateParticipant(userId, { isStreamingVideo: false });
  });

  socket.on('voiceRoom:closed', ({ chatId }: any) => {
    const store = useVoiceRoomStore.getState();
    if (store.activeChatId !== chatId) return;
    leaveVoiceRoom();
  });

  socket.on('voiceRoom:error', ({ chatId, code }: any) => {
    const msg = code === 'FULL' ? 'Комната переполнена'
      : code === 'VIDEO_LIMIT' ? 'Уже двое транслируют видео'
      : code === 'NOT_ALLOWED' ? 'Админ ещё не разрешил видео'
      : 'Нет доступа';
    alert(msg);
    if (code === 'FULL' || code === 'FORBIDDEN') {
      const store = useVoiceRoomStore.getState();
      if (store.activeChatId === chatId) leaveVoiceRoom();
    }
  });
}
