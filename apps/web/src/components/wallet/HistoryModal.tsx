import { useEffect, useMemo, useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Flame, Gift, CreditCard, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE' | 'REWARD' | 'TRANSFER' | 'BURN';
  amount: string;
  solAmount: string | null;
  solSignature: string | null;
  description: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
}

interface HistoryModalProps {
  onClose: () => void;
}

const PAGE = 30;

type Direction = 'all' | 'in' | 'out';
type TypeKey = 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE' | 'REWARD' | 'TRANSFER';

const TYPE_OPTIONS: TypeKey[] = ['DEPOSIT', 'TRANSFER', 'PURCHASE', 'REWARD', 'WITHDRAWAL'];

export function HistoryModal({ onClose }: HistoryModalProps) {
  const { t, locale } = useI18n();
  const userId = useAuthStore((s) => s.user?.id);
  const ru = locale === 'ru';

  const [items, setItems] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter state.
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<Direction>('all');
  const [enabledTypes, setEnabledTypes] = useState<Set<TypeKey>>(new Set(TYPE_OPTIONS));

  // Debounced search query for the API.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const params = useMemo(() => {
    const p: Record<string, string> = { limit: String(PAGE) };
    if (debouncedSearch) p.q = debouncedSearch;
    if (direction !== 'all') p.direction = direction;
    if (enabledTypes.size > 0 && enabledTypes.size < TYPE_OPTIONS.length) {
      p.types = Array.from(enabledTypes).join(',');
    }
    return p;
  }, [debouncedSearch, direction, enabledTypes]);

  const load = async (offset = 0) => {
    if (offset === 0) setLoading(true); else setLoadingMore(true);
    try {
      const { data } = await api.get('/wallet/history', { params: { ...params, offset } });
      const fresh = data.transactions as Transaction[];
      setItems((prev) => offset === 0 ? fresh : [...prev, ...fresh]);
      setTotal(data.total || 0);
    } catch { /* silent */ }
    setLoading(false);
    setLoadingMore(false);
  };

  // Reload from scratch whenever filters change.
  useEffect(() => { load(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params]);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(ru ? 'ru-RU' : 'en-US', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  const toggleType = (k: TypeKey) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      // Don't allow empty set — treat as "all".
      if (next.size === 0) TYPE_OPTIONS.forEach((x) => next.add(x));
      return next;
    });
  };

  const resetFilters = () => {
    setSearch('');
    setDirection('all');
    setEnabledTypes(new Set(TYPE_OPTIONS));
  };

  const hasActiveFilter =
    direction !== 'all' ||
    debouncedSearch !== '' ||
    (enabledTypes.size > 0 && enabledTypes.size < TYPE_OPTIONS.length);

  const hasMore = items.length < total;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500 shrink-0">
          <h3 className="font-semibold">{t('wallet.history')}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`p-2 rounded-lg transition-colors relative ${
                showFilters || hasActiveFilter
                  ? 'bg-primary-500/15 text-primary-500'
                  : 'hover:bg-gray-100 dark:hover:bg-dark-500'
              }`}
              aria-label={ru ? 'Фильтры' : 'Filters'}
            >
              <SlidersHorizontal size={16} />
              {hasActiveFilter && !showFilters && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary-500" />
              )}
            </button>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
              <X size={18} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-500 shrink-0 space-y-3 bg-gray-50/50 dark:bg-dark-800/40">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={ru ? 'Поиск по описанию…' : 'Search description…'}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-dark-600 border border-gray-200 dark:border-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>

            {/* Direction segmented control */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 dark:bg-dark-600 rounded-lg">
              {([
                ['all', ru ? 'Все' : 'All'],
                ['in',  ru ? 'Входящие' : 'Inbound'],
                ['out', ru ? 'Исходящие' : 'Outbound'],
              ] as Array<[Direction, string]>).map(([key, lbl]) => (
                <button
                  key={key}
                  onClick={() => setDirection(key)}
                  className={`text-xs font-medium py-1.5 rounded-md transition-colors ${
                    direction === key
                      ? 'bg-white dark:bg-dark-500 text-primary-500 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {/* Type chips */}
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((typeKey) => {
                const active = enabledTypes.has(typeKey);
                return (
                  <button
                    key={typeKey}
                    onClick={() => toggleType(typeKey)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full ring-1 transition-colors ${
                      active
                        ? 'bg-primary-500/15 ring-primary-500/30 text-primary-500'
                        : 'bg-transparent ring-gray-200 dark:ring-dark-500 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-600'
                    }`}
                  >
                    {typeLabel(typeKey, ru)}
                  </button>
                );
              })}
            </div>

            {hasActiveFilter && (
              <button
                onClick={resetFilters}
                className="text-[11px] text-primary-500 hover:underline"
              >
                {ru ? 'Сбросить фильтры' : 'Clear filters'}
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">
              {hasActiveFilter
                ? (ru ? 'Ничего не найдено' : 'No matches')
                : t('wallet.noTransactions')}
            </p>
          )}

          <ul className="space-y-1.5">
            {items.map((tx) => {
              const amount = BigInt(tx.amount);
              const isOut = tx.type === 'PURCHASE' ||
                tx.type === 'WITHDRAWAL' ||
                tx.type === 'BURN' ||
                (tx.type === 'TRANSFER' && (tx.description || '').toLowerCase().startsWith('transfer to'));
              const sign = isOut ? '-' : '+';
              const colorTone = isOut ? 'text-red-400' : 'text-emerald-400';

              const isCard = tx.type === 'DEPOSIT' && (tx.description || '').includes('YooKassa');
              const isSol = tx.type === 'DEPOSIT' && !isCard;

              const Icon =
                isCard ? CreditCard :
                tx.type === 'PURCHASE' ? Flame :
                tx.type === 'REWARD' ? Gift :
                isOut ? ArrowUpRight : ArrowDownLeft;

              const iconBg =
                isCard ? 'bg-emerald-500/15 text-emerald-400' :
                tx.type === 'PURCHASE' ? 'bg-orange-500/15 text-orange-400' :
                tx.type === 'REWARD' ? 'bg-amber-500/15 text-amber-400' :
                isOut ? 'bg-red-500/15 text-red-400' :
                'bg-emerald-500/15 text-emerald-400';

              const label = labelFor(tx, t, ru);

              return (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors"
                >
                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{label}</p>
                    <p className="text-[11px] text-gray-400">
                      {fmtTime(tx.createdAt)}
                      {isSol && tx.solAmount && (
                        <span className="ml-2 font-mono">{tx.solAmount} SOL</span>
                      )}
                    </p>
                  </div>
                  <p className={`text-sm font-mono font-bold shrink-0 ${colorTone}`}>
                    {sign}{amount.toLocaleString()} PLS
                  </p>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <div className="flex justify-center mt-3">
              <button
                onClick={() => load(items.length)}
                disabled={loadingMore}
                className="px-4 py-2 text-sm bg-dark-600 hover:bg-dark-500 rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingMore ? <Loader2 size={14} className="animate-spin inline" /> : t('common.loadMore')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function typeLabel(k: TypeKey, ru: boolean): string {
  if (ru) {
    switch (k) {
      case 'DEPOSIT': return 'Депозиты';
      case 'WITHDRAWAL': return 'Выводы';
      case 'PURCHASE': return 'Покупки';
      case 'REWARD': return 'Награды';
      case 'TRANSFER': return 'Переводы';
    }
  }
  switch (k) {
    case 'DEPOSIT': return 'Deposits';
    case 'WITHDRAWAL': return 'Withdrawals';
    case 'PURCHASE': return 'Purchases';
    case 'REWARD': return 'Rewards';
    case 'TRANSFER': return 'Transfers';
  }
}

function labelFor(tx: Transaction, _t: (k: any) => string, ru: boolean): string {
  const desc = tx.description || '';
  if (tx.type === 'DEPOSIT') {
    if (desc.includes('YooKassa')) return ru ? 'Пополнение картой' : 'Card top-up';
    return ru ? 'Депозит SOL' : 'SOL deposit';
  }
  if (tx.type === 'WITHDRAWAL') return ru ? 'Вывод' : 'Withdrawal';
  if (tx.type === 'PURCHASE') return desc || (ru ? 'Покупка' : 'Purchase');
  if (tx.type === 'REWARD') return desc || (ru ? 'Награда' : 'Reward');
  if (tx.type === 'TRANSFER') return desc || (ru ? 'Перевод' : 'Transfer');
  return desc || tx.type;
}
