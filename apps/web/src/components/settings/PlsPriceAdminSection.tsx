import { useEffect, useState } from 'react';
import { Coins, Loader2, History, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';

interface AdminData {
  effective: {
    pricePerPlsUsd: number;
    source: 'presale' | 'market';
    reference: number;
    market: { price: number; volumePls: string; trades: number } | null;
    clamped: boolean;
  };
  history: Array<{
    id: string;
    pricePerPlsUsd: number;
    setAt: string;
    notes: string | null;
    setByUser: { username: string; displayName: string | null } | null;
  }>;
}

export function PlsPriceAdminSection() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const [data, setData] = useState<AdminData | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get('/price/admin').then(({ data }) => setData(data)).catch(() => setData(null));
  };
  useEffect(load, []);

  const submit = async () => {
    const price = Number(newPrice);
    if (!price || price <= 0) {
      toast.error(tx('Введи положительное число', 'Enter a positive number'));
      return;
    }
    if (!confirm(tx(
      `Установить новый референсный курс PLS = $${price}?\nЭто видно всем пользователям.`,
      `Set new PLS reference rate to $${price}?\nThis is visible to all users.`,
    ))) return;
    setBusy(true);
    try {
      await api.post('/price/admin', { pricePerPlsUsd: price, notes });
      toast.success(tx('Курс обновлён', 'Rate updated'));
      setNewPrice('');
      setNotes('');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? tx('Ошибка', 'Error'));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return null;

  const eff = data.effective;
  const market = eff.market;

  return (
    <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Coins size={16} className="text-amber-400" />
        <span className="text-sm font-medium">{tx('Курс PLS (админ)', 'PLS rate (admin)')}</span>
      </div>

      {/* Effective + breakdown */}
      <div className="rounded-xl bg-dark-700/50 border border-dark-500 p-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-gray-400">{tx('Сейчас отображается', 'Currently shown')}</span>
          <span className="text-lg font-bold tabular-nums text-emerald-400">${eff.pricePerPlsUsd.toFixed(6)}</span>
        </div>
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="text-gray-500">{tx('Источник', 'Source')}</span>
          <span className={`font-semibold ${eff.source === 'market' ? 'text-cyan-400' : 'text-gray-300'}`}>
            {eff.source === 'market' ? tx('рынок 7д', 'market 7d') : tx('presale-референс', 'presale reference')}
            {eff.clamped && <span className="ml-1 text-amber-400">({tx('обрезан', 'clamped')})</span>}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-[11px]">
          <span className="text-gray-500">{tx('Референс', 'Reference')}</span>
          <span className="font-mono tabular-nums">${eff.reference.toFixed(6)}</span>
        </div>
        {market && (
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-gray-500">
              {tx('Рынок 7д (объём', 'Market 7d (volume')} {BigInt(market.volumePls).toLocaleString()} PLS, {market.trades} {tx('сделок', 'trades')})
            </span>
            <span className="font-mono tabular-nums">${market.price.toFixed(6)}</span>
          </div>
        )}
        {!market && (
          <p className="text-[10px] text-gray-500 italic">{tx('Сделок ещё мало — курс берётся из референса', 'Not enough volume yet — using reference')}</p>
        )}
      </div>

      {/* Set new reference */}
      <div className="rounded-xl bg-dark-700/50 border border-dark-500 p-3 space-y-2">
        <p className="text-xs text-gray-400 font-medium">{tx('Установить новый референс', 'Set new reference')}</p>
        <input
          type="number"
          step="0.000001"
          value={newPrice}
          onChange={(e) => setNewPrice(e.target.value)}
          placeholder={`USD ${tx('за 1 PLS', 'per 1 PLS')}`}
          className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none"
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={tx('Заметка (опционально)', 'Notes (optional)')}
          className="w-full bg-dark-800 border border-dark-500 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-primary-500 focus:outline-none"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-sm font-bold disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : tx('Обновить курс', 'Update rate')}
        </button>
        <div className="flex items-start gap-1.5 text-[10px] text-amber-400/80">
          <AlertTriangle size={10} className="shrink-0 mt-0.5" />
          {tx(
            'Каждое изменение записывается в журнал. Рыночный курс при достаточном объёме всё равно может перетянуть отображение, но с обрезкой ±50% от референса.',
            'Every change is logged. Market price wins display when there\'s enough volume, but is clamped to ±50% around reference.',
          )}
        </div>
      </div>

      {/* History */}
      {data.history.length > 0 && (
        <div className="rounded-xl bg-dark-700/50 border border-dark-500 p-3">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-400">
            <History size={12} />
            {tx('История изменений', 'Change history')}
          </div>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {data.history.map((h) => (
              <li key={h.id} className="text-[11px] flex items-baseline justify-between gap-2 border-b border-dark-500/50 pb-1.5 last:border-0">
                <div className="min-w-0">
                  <span className="font-mono tabular-nums">${h.pricePerPlsUsd.toFixed(6)}</span>
                  {h.notes && <span className="text-gray-500 ml-1.5 truncate">— {h.notes}</span>}
                </div>
                <span className="text-gray-500 shrink-0">
                  {h.setByUser ? `@${h.setByUser.username}` : '—'} · {new Date(h.setAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
