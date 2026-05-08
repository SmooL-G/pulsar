import { useEffect, useState } from 'react';
import { Flame, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n';

interface Stats {
  totalSupply: string;
  circulating: string;
  burned: string;
  burnedPctOfSupply: number;
  updatedAt: string;
}

let cache: Stats | null = null;
let cachedAt = 0;
const REFRESH_MS = 60_000;

export function BurnedSupplyCard() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [stats, setStats] = useState<Stats | null>(cache);

  useEffect(() => {
    if (!cache || Date.now() - cachedAt > REFRESH_MS) {
      fetch('/api/v1/economy/stats')
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          if (s) {
            cache = s;
            cachedAt = Date.now();
            setStats(s);
          }
        })
        .catch(() => { /* silent */ });
    }
  }, []);

  if (!stats) {
    return null; // tile only appears once we have data — quiet on first paint
  }

  const burned = BigInt(stats.burned);
  const circulating = BigInt(stats.circulating);

  // Compact human format: 1.23M / 4.5k / 678
  const fmt = (n: bigint): string => {
    const num = Number(n);
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k';
    return num.toLocaleString();
  };

  return (
    <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-orange-500/5 to-amber-500/5 p-4">
      <div className="flex items-baseline gap-1.5 mb-2">
        <Flame size={14} className="text-rose-400" />
        <span className="text-[10px] uppercase tracking-wider text-rose-300 font-bold">
          {tx('Сожжено навсегда', 'Burned forever')}
        </span>
      </div>

      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-2xl font-bold text-rose-300">{fmt(burned)}</span>
        <span className="text-xs text-gray-400">PLS</span>
        {stats.burnedPctOfSupply > 0 && (
          <span className="text-[10px] text-rose-400/80 ml-auto font-semibold">
            {stats.burnedPctOfSupply.toFixed(4)}%
          </span>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-rose-500/15 flex items-baseline justify-between text-[11px]">
        <span className="text-gray-400">{tx('В обращении', 'Circulating')}</span>
        <span className="font-mono tabular-nums text-gray-200">{fmt(circulating)} PLS</span>
      </div>

      <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">
        {tx(
          'Каждая P2P-сделка и подписка мерчанта навсегда уменьшает supply.',
          'Every P2P trade and merchant subscription permanently shrinks the supply.',
        )}
      </p>
    </div>
  );
}
