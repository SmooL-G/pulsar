import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Headphones, Check, ChevronDown } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import {
  acceptCall, rejectCall, cancelCall, endCall, toggleMute, toggleVideo,
  switchInputDevice, switchOutputDevice,
} from '../../p2p/callController';
import { useI18n } from '../../i18n';
import { useAudioDevices } from '../../hooks/useAudioDevices';

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
  const inputDeviceId = useCallStore((s) => s.inputDeviceId);
  const outputDeviceId = useCallStore((s) => s.outputDeviceId);
  const [deviceSheetOpen, setDeviceSheetOpen] = useState(false);
  const { inputs, outputs } = useAudioDevices();

  // Wire MediaStream → media elements. We re-run on every phase change
  // too because the audio element only mounts once phase != 'idle' and
  // we want srcObject reattached if the user accepts after a moment.
  useEffect(() => {
    if (!remoteStream) return;
    console.log('[call] attaching remoteStream', {
      audio: kind === 'audio' && !!audioRef.current,
      video: kind === 'video' && !!remoteVideoRef.current,
      tracks: remoteStream.getTracks().map((t) => `${t.kind}:${t.enabled}`),
    });
    if (kind === 'audio' && audioRef.current) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.volume = 1;
      audioRef.current.muted = false;
      audioRef.current.play()
        .then(() => console.log('[call] audio playing'))
        .catch((err) => console.warn('[call] audio play failed:', err));
    }
    if (kind === 'video' && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play()
        .then(() => console.log('[call] video playing'))
        .catch((err) => console.warn('[call] video play failed:', err));
    }
  }, [remoteStream, kind, phase]);

  useEffect(() => {
    if (kind === 'video' && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, kind]);

  // Output device routing (speaker / headset). setSinkId is supported
  // in Chromium-based browsers; Firefox and iOS Safari ignore it (the
  // OS routes audio there). We tolerate the rejection silently.
  useEffect(() => {
    const el = kind === 'audio' ? audioRef.current : remoteVideoRef.current;
    if (!el || !outputDeviceId) return;
    const anyEl = el as any;
    if (typeof anyEl.setSinkId !== 'function') return;
    anyEl.setSinkId(outputDeviceId)
      .then(() => console.log('[call] sinkId switched to', outputDeviceId))
      .catch((err: unknown) => console.warn('[call] setSinkId failed:', err));
  }, [outputDeviceId, kind, remoteStream]);

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
            <button
              onClick={() => setDeviceSheetOpen((v) => !v)}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                deviceSheetOpen ? 'bg-white text-dark-900' : 'bg-white/15 hover:bg-white/25'
              }`}
              aria-label={ru ? 'Устройства' : 'Devices'}
              title={ru ? 'Микрофон и динамики' : 'Mic & speakers'}
            >
              <Headphones size={22} />
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

      {/* Device picker sheet — slides up from the bottom over the
          action bar when the headset button is tapped. */}
      {deviceSheetOpen && phase === 'active' && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 p-4 pb-8 bg-dark-800/95 backdrop-blur-xl rounded-t-3xl shadow-2xl animate-fade-in max-h-[60%] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{ru ? 'Аудио-устройства' : 'Audio devices'}</h3>
            <button
              onClick={() => setDeviceSheetOpen(false)}
              className="text-white/60 hover:text-white"
              aria-label={ru ? 'Закрыть' : 'Close'}
            >
              <ChevronDown size={20} />
            </button>
          </div>

          {/* Input devices (microphones) */}
          <div className="mb-4">
            <p className="text-[11px] uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1.5">
              <Mic size={12} /> {ru ? 'Микрофон' : 'Microphone'}
            </p>
            <div className="space-y-1">
              {inputs.length === 0 && (
                <p className="text-xs text-white/40 italic">{ru ? 'Устройств не найдено' : 'No devices found'}</p>
              )}
              {inputs.map((d) => {
                const active = d.deviceId === inputDeviceId
                  || (!inputDeviceId && d.deviceId === 'default');
                return (
                  <button
                    key={d.deviceId}
                    onClick={() => switchInputDevice(d.deviceId)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                      active ? 'bg-primary-500/30 text-white' : 'bg-white/5 hover:bg-white/10 text-white/80'
                    }`}
                  >
                    {active ? <Check size={16} /> : <span className="w-4" />}
                    <span className="text-sm truncate flex-1">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Output devices (speakers / headset) */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-white/50 mb-2 flex items-center gap-1.5">
              <Headphones size={12} /> {ru ? 'Динамики / Гарнитура' : 'Speaker / Headset'}
            </p>
            <div className="space-y-1">
              {outputs.length === 0 && (
                <p className="text-xs text-white/40 italic">
                  {ru
                    ? 'Браузер не разрешает выбор вывода. Управляется системой.'
                    : 'Browser doesn\'t expose output selection — controlled by OS.'}
                </p>
              )}
              {outputs.map((d) => {
                const active = d.deviceId === outputDeviceId
                  || (!outputDeviceId && d.deviceId === 'default');
                return (
                  <button
                    key={d.deviceId}
                    onClick={() => switchOutputDevice(d.deviceId)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                      active ? 'bg-primary-500/30 text-white' : 'bg-white/5 hover:bg-white/10 text-white/80'
                    }`}
                  >
                    {active ? <Check size={16} /> : <span className="w-4" />}
                    <span className="text-sm truncate flex-1">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
