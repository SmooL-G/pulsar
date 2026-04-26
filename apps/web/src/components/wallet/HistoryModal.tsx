import { useEffect, useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, Flame, Gift, CreditCard, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'PURCHASE' | 'REWARD' | 'TRANSFER';
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

export function HistoryModal({ onClose }: HistoryModalProps) {
  const { t, locale } = useI18n();
  const userId = useAuthStore((s) => s.user?.id);
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (offset = 0) => {
    if (offset === 0) setLoading(true); else setLoadingMore(true);
    try {
      const { data } = await api.get('/wallet/history', { params: { limit: PAGE, offset } });
      const fresh = data.transactions as Transaction[];
      setItems((prev) => offset === 0 ? fresh : [...prev, ...fresh]);
      setHasMore(offset + fresh.length < (data.total || 0));
    } catch { /* silent */ }
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => { load(0); }, []);

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500 shrink-0">
          <h3 className="font-semibold">{t('wallet.history')}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">{t('wallet.noTransactions')}</p>
          )}

          <ul className="space-y-1.5">
            {items.map((tx) => {
              const amount = BigInt(tx.amount);
              // Direction: TRANSFER + description starts with "to" → outgoing; other TRANSFER → incoming.
              // For now: DEPOSIT/REWARD = incoming (+), PURCHASE = outgoing (-, burn-style),
              // TRANSFER and WITHDRAWAL inferred from description prefix.
              const isOut = tx.type === 'PURCHASE' ||
                tx.type === 'WITHDRAWAL' ||
                (tx.type === 'TRANSFER' && (tx.description || '').toLowerCase().startsWith('to '));
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

              const label = labelFor(tx, t, locale === 'ru');

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

function labelFor(tx: Transaction, t: (k: any) => string, ru: boolean): string {
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
