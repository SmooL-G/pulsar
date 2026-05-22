import { useEffect, useState, useRef } from 'react';
import { useI18n } from '../../i18n';

interface Stats {
  userCount: number;
  onlineCount: number;
}

function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const startValRef = useRef(0);

  useEffect(() => {
    startValRef.current = display;
    startRef.current = Date.now();
    const end = Date.now() + duration;

    const tick = () => {
      const now = Date.now();
      if (now >= end) {
        setDisplay(value);
        return;
      }
      const progress = (now - startRef.current) / duration;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValRef.current + (value - startValRef.current) * eased));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

export function UserCountInformer() {
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pulse, setPulse] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/v1/stats/public');
        const data = await res.json();
        setStats(data);
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      } catch {
        // silent
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Scan line animation
  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;
    let frame: number;
    let y = 0;

    const animate = () => {
      y = (y + 0.5) % 100;
      el.style.background = `linear-gradient(180deg,
        transparent ${y - 5}%,
        rgba(0, 255, 170, 0.06) ${y}%,
        transparent ${y + 5}%
      )`;
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!stats) return null;

  return (
    <div className="hidden md:block fixed top-4 right-4 z-20">
      <div
        className={`relative overflow-hidden rounded-xl border border-emerald-500/20 bg-dark-800/80 backdrop-blur-md
          shadow-[0_0_20px_rgba(0,255,170,0.08)] transition-all duration-300
          ${pulse ? 'shadow-[0_0_30px_rgba(0,255,170,0.2)]' : ''}`}
      >
        {/* Scan line overlay */}
        <div ref={glowRef} className="absolute inset-0 pointer-events-none" />

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-emerald-400/40" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-emerald-400/40" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-emerald-400/40" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-emerald-400/40" />

        <div className="relative px-4 py-3 flex items-center gap-4">
          {/* Users count */}
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-medium">
              {t('stats.users')}
            </span>
            <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
              <AnimatedNumber value={stats.userCount} />
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gradient-to-b from-transparent via-emerald-500/30 to-transparent" />

          {/* Online count */}
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-medium">
              {t('stats.online')}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
                <AnimatedNumber value={stats.onlineCount} />
              </span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      </div>
    </div>
  );
}
