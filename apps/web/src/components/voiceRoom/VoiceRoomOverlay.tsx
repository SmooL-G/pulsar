import { useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff, Minimize2, Maximize2, Hand, Check, X } from 'lucide-react';
import { useVoiceRoomStore, type VoiceRoomParticipant } from '../../store/voiceRoomStore';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useI18n } from '../../i18n';
import {
  leaveVoiceRoom, toggleMute, requestVideo, grantVideo, startMyVideo, stopMyVideo,
} from '../../p2p/voiceRoomController';

/**
 * Full-screen overlay for an active group voice room. Mounted once in
 * AppLayout; null-renders when no room is active. Supports minimize to
 * a floating pill so the user can keep chatting while in the room.
 */
export function VoiceRoomOverlay() {
  const activeChatId = useVoiceRoomStore((s) => s.activeChatId);
  const participants = useVoiceRoomStore((s) => s.participants);
  const myMuted = useVoiceRoomStore((s) => s.myMuted);
  const myVideoOn = useVoiceRoomStore((s) => s.myVideoOn);
  const isMinimized = useVoiceRoomStore((s) => s.isMinimized);
  const setMinimized = useVoiceRoomStore((s) => s.setMinimized);
  const videoRequests = useVoiceRoomStore((s) => s.videoRequests);
  const locale = useI18n((s) => s.locale);
  const ru = locale === 'ru';
  const myId = useAuthStore((s) => s.user?.id);
  const activeChat = useChatStore((s) => s.activeChat);
  const myRole = (activeChat as any)?.myRole;
  const iAmAdmin = activeChatId === activeChat?.id
    && (myRole === 'OWNER' || myRole === 'ADMIN' || myRole === 'MODERATOR');

  if (!activeChatId) return null;

  const list = Array.from(participants.values()).sort((a, b) => a.joinedAt - b.joinedAt);
  const speakingNow = list.find((p) => p.isSpeaking);
  const me = list.find((p) => p.userId === myId);

  // ───── Minimized pill ─────────────────────────────────────────────
  if (isMinimized) {
    return (
      <>
        <ParticipantAudioSinks list={list} myId={myId} />
        <button
          onClick={() => setMinimized(false)}
          className="
            fixed bottom-20 right-4 z-[110] md:bottom-4
            flex items-center gap-2.5 pl-2 pr-3 py-2
            rounded-full shadow-2xl ring-2 ring-emerald-400/40
            bg-gradient-to-r from-emerald-500 to-emerald-600
            text-white hover:from-emerald-600 hover:to-emerald-700
            transition-all active:scale-95 animate-fade-in
          "
          aria-label={ru ? 'Развернуть голосовой чат' : 'Restore voice room'}
        >
          <span className="relative w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-xs font-bold">🎤</span>
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-white text-emerald-600 text-[10px] font-bold flex items-center justify-center ring-1 ring-emerald-500">
              {list.length}
            </span>
          </span>
          <span className="text-xs font-medium truncate max-w-[120px]">
            {speakingNow?.profile?.displayName || speakingNow?.profile?.username || (ru ? 'Голосовой чат' : 'Voice room')}
          </span>
          <Maximize2 size={14} className="opacity-80" />
        </button>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col backdrop-blur-2xl bg-gradient-to-br from-emerald-900/95 via-dark-900/95 to-dark-700/95 text-white">
      <ParticipantAudioSinks list={list} myId={myId} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => setMinimized(true)}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center"
          aria-label={ru ? 'Свернуть' : 'Minimize'}
        >
          <Minimize2 size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold">{ru ? 'Голосовой чат' : 'Voice room'}</p>
          <p className="text-xs text-white/60">{list.length} {ru ? 'участн.' : 'in room'}</p>
        </div>
        <div className="w-10" />
      </div>

      {/* Video-request banner for admins */}
      {iAmAdmin && videoRequests.size > 0 && (
        <VideoRequestPanel requests={videoRequests} participants={participants} ru={ru} />
      )}

      {/* Participants grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {list.map((p) => (
            <ParticipantTile
              key={p.userId}
              p={p}
              isMe={p.userId === myId}
              iAmAdmin={iAmAdmin}
              ru={ru}
            />
          ))}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-center gap-4 pb-8 pt-2">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            myMuted ? 'bg-white text-dark-900' : 'bg-white/15 hover:bg-white/25'
          }`}
          aria-label={myMuted ? (ru ? 'Включить микрофон' : 'Unmute') : (ru ? 'Микрофон выкл.' : 'Mute')}
        >
          {myMuted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        {me?.canStreamVideo ? (
          <button
            onClick={() => myVideoOn ? stopMyVideo() : startMyVideo()}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
              myVideoOn ? 'bg-white text-dark-900' : 'bg-white/15 hover:bg-white/25'
            }`}
            aria-label={myVideoOn ? (ru ? 'Выкл. камеру' : 'Stop camera') : (ru ? 'Вкл. камеру' : 'Start camera')}
          >
            {myVideoOn ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
        ) : (
          <button
            onClick={requestVideo}
            className="w-14 h-14 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center shadow-lg transition-colors"
            aria-label={ru ? 'Запросить видео' : 'Request video'}
            title={ru ? 'Запросить разрешение на видео' : 'Request video permission'}
          >
            <Hand size={22} />
          </button>
        )}

        <button
          onClick={() => leaveVoiceRoom()}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform active:scale-95"
          aria-label={ru ? 'Выйти' : 'Leave'}
        >
          <PhoneOff size={26} />
        </button>
      </div>
    </div>
  );
}

/** Mounted <audio> sink per remote participant. Stays mounted across
 *  minimize/restore so streams keep flowing. */
function ParticipantAudioSinks({ list, myId }: { list: VoiceRoomParticipant[]; myId?: string }) {
  return (
    <>
      {list.filter((p) => p.userId !== myId && p.stream).map((p) => (
        <RemoteAudio key={p.userId} stream={p.stream!} />
      ))}
    </>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => { /* autoplay blocked */ });
    }
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

function ParticipantTile({ p, isMe, iAmAdmin, ru }: {
  p: VoiceRoomParticipant; isMe: boolean; iAmAdmin: boolean; ru: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (p.stream && p.isStreamingVideo && videoRef.current) {
      videoRef.current.srcObject = p.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [p.stream, p.isStreamingVideo]);

  const initial = (p.profile?.displayName || p.profile?.username || '?')[0].toUpperCase();
  const ringClass = p.isSpeaking
    ? 'ring-4 ring-emerald-400 shadow-emerald-400/50'
    : 'ring-2 ring-white/20';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative w-24 h-24 rounded-full overflow-hidden ${ringClass} transition-all shadow-lg`}>
        {p.isStreamingVideo && p.stream ? (
          <video ref={videoRef} autoPlay playsInline muted={isMe} className="w-full h-full object-cover" />
        ) : p.profile?.avatarUrl ? (
          <img src={p.profile.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-3xl font-bold">
            {initial}
          </div>
        )}
        {p.isMuted && (
          <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center ring-2 ring-dark-900">
            <MicOff size={14} />
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-center truncate w-full">
        {p.profile?.displayName || p.profile?.username || '...'}
        {isMe && <span className="text-white/50"> ({ru ? 'вы' : 'you'})</span>}
      </p>
      {iAmAdmin && !isMe && (
        <button
          onClick={() => grantVideo(p.userId, !p.canStreamVideo)}
          className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
            p.canStreamVideo
              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              : 'bg-white/10 text-white/60 hover:bg-white/20'
          }`}
        >
          {p.canStreamVideo ? (ru ? 'Видео ✓' : 'Video ✓') : (ru ? 'Видео ✗' : 'No video')}
        </button>
      )}
    </div>
  );
}

function VideoRequestPanel({ requests, participants, ru }: {
  requests: Set<string>;
  participants: Map<string, VoiceRoomParticipant>;
  ru: boolean;
}) {
  return (
    <div className="mx-4 mb-3 p-3 rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/30 backdrop-blur">
      <p className="text-xs font-semibold text-amber-200 mb-2">
        {ru ? 'Запросы на видео' : 'Video requests'}
      </p>
      <div className="space-y-1.5">
        {Array.from(requests).map((userId) => {
          const p = participants.get(userId);
          const name = p?.profile?.displayName || p?.profile?.username || userId.slice(0, 6);
          return (
            <div key={userId} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-1.5">
              <span className="text-sm">{name}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => grantVideo(userId, true)}
                  className="w-7 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center"
                  aria-label={ru ? 'Разрешить' : 'Allow'}
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => grantVideo(userId, false)}
                  className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
                  aria-label={ru ? 'Отклонить' : 'Deny'}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
