import { useEffect, useState } from 'react';
import { Clock, Zap } from 'lucide-react';
import { useI18n } from '../../i18n';

interface HalvingInfo {
  era: number;
  anchorAt: string;
  intervalDays: number;
  nextHalvingAt: string;
  currentRates: {
    baseRatePerHourPls: string;
    bandwidthBonusPerGbPls: string;
    peerBonusPerPeerPls: string;
    maxDailyPayoutPls: string;
  };
}

let cache: HalvingInfo | null = null;
let cachedAt = 0;
const REFRESH_MS = 5 * 60_000;

export function HalvingCountdown({ compact = false }: { compact?: boolean }) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [info, setInfo] = useState<HalvingInfo | null>(cache);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!cache || Date.now() - cachedAt > REFRESH_MS) {
      fetch('/api/v1/economy/halving')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            cache = d;
            cachedAt = Date.now();
            setInfo(d);
          }
        })
        .catch(() => { /* silent */ });
    }
    const id = setInterval(() => setNow(Date.now()), 60_000); // re-render every minute
    return () => clearInterval(id);
  }, []);

  if (!info) return null;

  const remainingMs = new Date(info.nextHalvingAt).getTime() - now;
  const remainingDays = Math.max(0, Math.floor(remainingMs / (24 * 60 * 60 * 1000)));
  const remainingHours = Math.max(0, Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/5 p-4">
      <div className="flex items-baseline gap-1.5 mb-2">
        <Zap size={14} className="text-amber-400" />
        <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
          {tx('Следующий halving', 'Next halving')}
        </span>
        <span className="ml-auto text-[10px] text-gray-500 font-mono">era {info.era}</span>
      </div>

      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-2xl font-bold text-amber-300">{remainingDays}</span>
        <span className="text-xs text-gray-400">{tx('дней', 'days')}</span>
        <span className="text-sm text-amber-300/70">{remainingHours}{tx('ч', 'h')}</span>
        <Clock size={11} className="text-amber-500/60 ml-auto" />
      </div>

      <p className="text-[10px] text-gray-500 mt-1.5 tabular-nums">
        {new Date(info.nextHalvingAt).toLocaleDateString(ru ? 'ru-RU' : 'en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })}
      </p>

      {!compact && (
        <div className="mt-3 pt-3 border-t border-amber-500/15 grid grid-cols-2 gap-2 text-[11px]">
          <Stat label={tx('Сейчас', 'Now')} value={`${info.currentRates.baseRatePerHourPls} PLS/${tx('ч', 'h')}`} />
          <Stat label={tx('После', 'After')} value={`${(BigInt(info.currentRates.baseRatePerHourPls) / 2n).toString()} PLS/${tx('ч', 'h')}`} dim />
          <Stat label={tx('Cap/день', 'Cap/day')} value={`${BigInt(info.currentRates.maxDailyPayoutPls).toLocaleString()} PLS`} />
          <Stat label={tx('После', 'After')} value={`${(BigInt(info.currentRates.maxDailyPayoutPls) / 2n).toLocaleString()} PLS`} dim />
        </div>
      )}

      <p className="text-[10px] text-gray-500 mt-2 leading-snug">
        {tx(
          'Награды майнерам автоматически уменьшаются вдвое каждые 2 года — защита от инфляции.',
          'Mining rewards automatically halve every 2 years — supply protection.',
        )}
      </p>
    </div>
  );
}

function Stat({ label, value, dim = false }: { label: string; value: string; dim?: boolean }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className={`font-mono tabular-nums ${dim ? 'text-gray-400' : 'text-gray-200'}`}>{value}</p>
    </div>
  );
}
