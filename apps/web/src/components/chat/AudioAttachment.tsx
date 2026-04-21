import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Download, Music, Mic } from 'lucide-react';
import { useI18n } from '../../i18n';

interface AudioAttachmentProps {
  url: string;
  fileName: string;
  sizeStr: string;
  isOwn: boolean;
  /** When true, shows "Voice message" label + mic icon instead of the raw file name. */
  isVoice?: boolean;
}

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioAttachment({ url, fileName, sizeStr, isOwn, isVoice }: AudioAttachmentProps) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => setDuration(a.duration || 0);
    const onTime = () => setCurrent(a.currentTime || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onWait = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnd);
    a.addEventListener('waiting', onWait);
    a.addEventListener('playing', onPlaying);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('waiting', onWait);
      a.removeEventListener('playing', onPlaying);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // Pause any other playing audio first (single playback)
      document.querySelectorAll<HTMLAudioElement>('audio').forEach((other) => {
        if (other !== a && !other.paused) other.pause();
      });
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    a.currentTime = (x / rect.width) * duration;
  };

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  const bg = isOwn ? 'bg-white/10' : 'bg-dark-500/50';
  const accent = isOwn ? 'text-white' : 'text-primary-400';
  const subtle = isOwn ? 'text-blue-200' : 'text-gray-400';
  const fillCls = isOwn ? 'bg-white' : 'bg-primary-400';

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl ${bg} min-w-[260px] max-w-[320px]`}>
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Play / Pause */}
      <button
        onClick={toggle}
        className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isOwn ? 'bg-white/15 hover:bg-white/25' : 'bg-primary-500/20 hover:bg-primary-500/30'
        }`}
        title={playing ? 'Pause' : 'Play'}
      >
        {loading ? (
          <div className={`w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${accent}`} />
        ) : playing ? (
          <Pause size={16} className={accent} fill="currentColor" />
        ) : (
          <Play size={16} className={accent} fill="currentColor" />
        )}
      </button>

      {/* Title + progress */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate flex items-center gap-1 ${isOwn ? 'text-white' : 'text-gray-200'}`}>
          {isVoice ? <Mic size={11} className={subtle} /> : <Music size={11} className={subtle} />}
          {isVoice ? t('voice.message') : fileName}
        </p>
        <div
          onClick={seek}
          className={`mt-1.5 h-1.5 rounded-full overflow-hidden cursor-pointer ${
            isOwn ? 'bg-white/20' : 'bg-dark-700'
          }`}
        >
          <div className={`h-full transition-all ${fillCls}`} style={{ width: `${progress}%` }} />
        </div>
        <p className={`text-[10px] mt-1 flex items-center justify-between ${subtle}`}>
          <span>{fmt(current)} / {fmt(duration)}</span>
          <span>{sizeStr}</span>
        </p>
      </div>

      {/* Download */}
      <a
        href={url}
        download={fileName}
        target="_blank"
        rel="noopener noreferrer"
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          isOwn ? 'hover:bg-white/15 text-white' : 'hover:bg-dark-500 text-gray-400 hover:text-white'
        }`}
        title="Скачать"
      >
        <Download size={14} />
      </a>
    </div>
  );
}
