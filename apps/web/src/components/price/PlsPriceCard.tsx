import { useState } from 'react';
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import {
  CURRENCIES,
  formatFiat,
  plsToFiat,
  useDisplayCurrency,
  usePlsPrice,
  type Currency,
} from '../../hooks/usePlsPrice';
import { useI18n } from '../../i18n';
import { PriceSparkline } from './PriceSparkline';

type SparkWindow = '24h' | '7d' | '30d';

interface Props {
  /** PLS balance to convert into fiat. Pass 0 to show only the rate. */
  balancePls?: number | bigint;
  /** Compact mode hides the balance line and shrinks paddings. */
  compact?: boolean;
  /** Hide the embedded sparkline (e.g., when card is used inline somewhere tight). */
  hideChart?: boolean;
}

export function PlsPriceCard({ balancePls = 0, compact = false, hideChart = false }: Props) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const snap = usePlsPrice();
  const currency = useDisplayCurrency((s) => s.currency);
  const setCurrency = useDisplayCurrency((s) => s.setCurrency);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sparkWindow, setSparkWindow] = useState<SparkWindow>('24h');

  const balance = typeof balancePls === 'bigint' ? Number(balancePls) : balancePls;
  const fiatBalance = plsToFiat(balance, snap, currency);
  const ratePls = snap ? plsToFiat(1, snap, currency) : null;

  const change = snap?.pls.change24h ?? 0;
  const changeUp = change >= 0;
  const TrendIcon = changeUp ? TrendingUp : TrendingDown;

  return (
    <div
      className={`relative rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-500/10 via-cyan-500/5 to-emerald-500/5 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      {/* Currency picker — corner dropdown */}
      <div className="absolute top-2 right-2">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium text-gray-400 hover:text-white bg-dark-800/60 rounded-md transition-colors"
        >
          {currency}
          <ChevronDown size={10} className={`transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
        </button>
        {pickerOpen && (
          <div className="absolute right-0 mt-1 w-44 bg-dark-700 border border-dark-500 rounded-lg shadow-xl z-10 overflow-hidden">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => { setCurrency(c.code as Currency); setPickerOpen(false); }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs hover:bg-dark-600 transition-colors ${
                  currency === c.code ? 'bg-primary-500/10 text-primary-300' : ''
                }`}
              >
                <span className="font-medium">{c.code}</span>
                <span className="text-gray-500 truncate ml-2">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">PLS</span>
        <span className="text-[10px] text-gray-500">
          {snap?.pls.source === 'market'
            ? (ru ? 'рынок 7д' : 'market 7d')
            : (ru ? 'пресейл' : 'presale')}
        </span>
      </div>

      {/* Big rate */}
      <div className="flex items-end gap-2">
        <div className="text-2xl font-bold tabular-nums">
          {ratePls !== null
            ? formatFiat(ratePls, currency, ratePls < 0.01 ? 6 : 4)
            : <span className="text-gray-500">—</span>}
        </div>
        {snap && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold mb-0.5 ${
            change === 0 ? 'text-gray-500' : changeUp ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            <TrendIcon size={12} />
            {change === 0 ? '—' : `${changeUp ? '+' : ''}${change.toFixed(2)}%`}
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-500 mt-0.5">{ru ? 'за 1 PLS · 24ч' : 'per 1 PLS · 24h'}</p>

      {/* Sparkline + window switcher */}
      {!hideChart && !compact && (
        <div className="mt-3">
          <PriceSparkline window={sparkWindow} color={changeUp ? '#10b981' : change < 0 ? '#f43f5e' : '#5c7cfa'} />
          <div className="mt-1 flex justify-end gap-1">
            {(['24h', '7d', '30d'] as SparkWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setSparkWindow(w)}
                className={`text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                  sparkWindow === w
                    ? 'bg-primary-500/30 text-primary-200'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Balance worth */}
      {!compact && balance > 0 && fiatBalance !== null && (
        <div className="mt-3 pt-3 border-t border-dark-500/40">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-gray-400">{ru ? 'Твой баланс' : 'Your balance'}</span>
            <span className="text-sm font-semibold text-emerald-300 tabular-nums">
              ≈ {formatFiat(fiatBalance, currency)}
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums">
            {balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} PLS
          </p>
        </div>
      )}
    </div>
  );
}

/** Tiny inline badge — single line, fits anywhere (login form, header, sidebar). */
export function PlsPriceBadge() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const snap = usePlsPrice();
  const currency = useDisplayCurrency((s) => s.currency);
  const ratePls = snap ? plsToFiat(1, snap, currency) : null;
  const change = snap?.pls.change24h ?? 0;
  const changeUp = change >= 0;

  if (!snap) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-[11px]">
      <span className="font-semibold text-primary-300">PLS</span>
      <span className="text-white tabular-nums">
        {ratePls !== null ? formatFiat(ratePls, currency, ratePls < 0.01 ? 6 : 4) : '—'}
      </span>
      <span className={`tabular-nums ${
        change === 0 ? 'text-gray-500' : changeUp ? 'text-emerald-400' : 'text-rose-400'
      }`}>
        {change === 0
          ? (snap.pls.source === 'market' ? (ru ? 'рынок' : 'market') : (ru ? 'пресейл' : 'presale'))
          : `${changeUp ? '+' : ''}${change.toFixed(1)}%`}
      </span>
    </div>
  );
}
