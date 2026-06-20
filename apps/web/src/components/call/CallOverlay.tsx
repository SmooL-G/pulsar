import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import {
  acceptCall, rejectCall, cancelCall, endCall, toggleMute, toggleVideo,
} from '../../p2p/callController';
import { useI18n } from '../../i18n';

/**
 * Single full-screen overlay that handles every call phase. Mounted
 * once in AppLayout. Returns null when phase === 'idle' (no-op render).
 */
export function CallOverlay() {
  const phase = useCallStore((s) => s.phase);
  const peer = useCallStore((s) => s.peer);
  const kind = useCallStore((s) => s.kind);
  const isMuted = useCallStore((s) => s.isMuted);
  const isVideoMuted = useCallStore((s) => s.isVideoMuted);
  const startedAt = useCallStore((s) => s.startedAt);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const localStream = useCallStore((s) => s.localStream);
  const endReason = useCallStore((s) => s.endReason);
  const locale = useI18n((s) => s.locale);
  const ru = locale === 'ru';

  const audioRef = useRef<HTMLAudioElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Wire MediaStream → media elements.
  useEffect(() => {
    if (kind === 'audio' && audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch(() => { /* autoplay blocked */ });
    }
    if (kind === 'video' && remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, kind]);

  useEffect(() => {
    if (kind === 'video' && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, kind]);

  // Duration counter.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (phase !== 'active' || !startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [phase, startedAt]);

  if (phase === 'idle' || !peer) return null;

  const duration = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const mm = Math.floor(duration / 60).toString().padStart(2, '0');
  const ss = (duration % 60).toString().padStart(2, '0');

  const initial = (peer.displayName || peer.username || '?')[0].toUpperCase();

  const subtitle = (() => {
    if (phase === 'incoming') return ru ? 'Входящий звонок…' : 'Incoming call…';
    if (phase === 'outgoing') return ru ? 'Вызов…' : 'Calling…';
    if (phase === 'active')   return `${mm}:${ss}`;
    if (phase === 'ended') {
      if (endReason === 'rejected')    return ru ? 'Отклонено' : 'Rejected';
      if (endReason === 'cancelled')   return ru ? 'Отменено' : 'Cancelled';
      if (endReason === 'unavailable') return ru ? 'Не в сети' : 'Unavailable';
      if (endReason === 'missed')      return ru ? 'Пропущенный' : 'Missed';
      return ru ? 'Завершено' : 'Ended';
    }
    return '';
  })();

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between p-8 backdrop-blur-2xl bg-gradient-to-br from-primary-900/95 via-dark-900/95 to-dark-700/95 text-white">
      {/* Hidden audio sink for audio-only calls */}
      {kind === 'audio' && <audio ref={audioRef} autoPlay playsInline />}

      {/* Remote video */}
      {kind === 'video' && phase === 'active' && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover -z-10"
        />
      )}

      {/* Local self-preview (top-right) for video calls */}
      {kind === 'video' && localStream && (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute top-6 right-6 w-32 aspect-[3/4] object-cover rounded-2xl ring-2 ring-white/40 shadow-xl"
        />
      )}

      {/* Peer info — center stage for audio / overlay header for video */}
      <div className="flex flex-col items-center gap-4 mt-12">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-5xl font-bold shadow-2xl ring-4 ring-white/20 overflow-hidden">
          {peer.avatarUrl ? (
            <img src={peer.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-semibold">
            {peer.displayName || `@${peer.username}`}
          </h2>
          <p className="text-sm text-white/70 mt-1">{subtitle}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-6 mb-6">
        {phase === 'incoming' && (
          <>
            <button
              onClick={() => rejectCall()}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform active:scale-95"
              aria-label={ru ? 'Отклонить' : 'Reject'}
            >
              <PhoneOff size={26} />
            </button>
            <button
              onClick={() => acceptCall()}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg transition-transform active:scale-95 animate-pulse"
              aria-label={ru ? 'Принять' : 'Accept'}
            >
              <Phone size={26} />
            </button>
          </>
        )}

        {phase === 'outgoing' && (
          <button
            onClick={() => cancelCall()}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform active:scale-95"
            aria-label={ru ? 'Отмена' : 'Cancel'}
          >
            <PhoneOff size={26} />
          </button>
        )}

        {phase === 'active' && (
          <>
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                isMuted ? 'bg-white text-dark-900' : 'bg-white/15 hover:bg-white/25'
              }`}
              aria-label={isMuted ? (ru ? 'Включить микрофон' : 'Unmute') : (ru ? 'Микрофон выкл.' : 'Mute')}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            {kind === 'video' && (
              <button
                onClick={toggleVideo}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                  isVideoMuted ? 'bg-white text-dark-900' : 'bg-white/15 hover:bg-white/25'
                }`}
                aria-label={isVideoMuted ? (ru ? 'Камера вкл.' : 'Camera on') : (ru ? 'Камера выкл.' : 'Camera off')}
              >
                {isVideoMuted ? <VideoOff size={22} /> : <Video size={22} />}
              </button>
            )}
            <button
              onClick={() => endCall()}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transition-transform active:scale-95"
              aria-label={ru ? 'Завершить' : 'Hang up'}
            >
              <PhoneOff size={26} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
