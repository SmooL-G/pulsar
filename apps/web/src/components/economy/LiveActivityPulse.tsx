import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';

interface Pulse {
  typingNow: number;
  onlineNow: number;
  updatedAt: string;
}

let cache: Pulse | null = null;
let cachedAt = 0;
const REFRESH_MS = 5_000;

/** Live "X people typing right now / Y online" pulse. Public — works
 *  on the login page before sign-in too. Auto-refreshes every 5s. */
export function LiveActivityPulse({ compact = false }: { compact?: boolean }) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [pulse, setPulse] = useState<Pulse | null>(cache);

  useEffect(() => {
    const refresh = () => {
      if (cache && Date.now() - cachedAt < REFRESH_MS) return;
      fetch('/api/v1/economy/pulse')
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => {
          if (p) {
            cache = p;
            cachedAt = Date.now();
            setPulse(p);
          }
        })
        .catch(() => { /* silent */ });
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  if (!pulse) return null;

  // Compact mode: single inline pill (for login page header)
  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
        </span>
        <span className="text-emerald-300 font-semibold tabular-nums">{pulse.onlineNow}</span>
        <span className="text-gray-400">{tx('онлайн', 'online')}</span>
        {pulse.typingNow > 0 && (
          <>
            <span className="text-gray-500">·</span>
            <span className="text-emerald-300 font-semibold tabular-nums">{pulse.typingNow}</span>
            <span className="text-gray-400">{tx('печатают', 'typing')}</span>
          </>
        )}
      </div>
    );
  }

  // Full card variant for the dashboard
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-primary-500/5 p-4">
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
        <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
          {tx('Сейчас в Pulsar', 'Live in Pulsar')}
        </span>
      </div>

      <div className="flex items-baseline gap-4 tabular-nums">
        <div>
          <div className="text-2xl font-bold text-emerald-300">{pulse.onlineNow}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            {tx('онлайн', 'online')}
          </div>
        </div>
        <div className={`transition-opacity ${pulse.typingNow > 0 ? 'opacity-100' : 'opacity-50'}`}>
          <div className="text-2xl font-bold text-cyan-300">{pulse.typingNow}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">
            {tx('печатают сейчас', 'typing now')}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 mt-2 leading-snug">
        {tx(
          'Каждое сообщение в чатах отражается здесь в реальном времени.',
          'Every keystroke across the platform reflects here in real time.',
        )}
      </p>
    </div>
  );
}
