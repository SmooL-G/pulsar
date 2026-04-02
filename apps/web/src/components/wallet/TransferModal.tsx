import { useState, useRef, useEffect } from 'react';
import { X, Send, Check, Search } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

interface TransferModalProps {
  onClose: () => void;
  prefillUserId?: string;
}

export function TransferModal({ onClose, prefillUserId }: TransferModalProps) {
  const { t } = useI18n();
  const { user, setUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [success, setSuccess] = useState<{ received?: string } | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Если передан prefillUserId — загружаем пользователя
  useEffect(() => {
    if (prefillUserId) {
      api.get(`/users/${prefillUserId}`).then(({ data }) => {
        setSelectedUser({ id: data.id, username: data.username });
      }).catch(() => {});
    }
  }, [prefillUserId]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/users?search=${encodeURIComponent(query)}&limit=5`);
        setSearchResults((data.users || []).filter((u: any) => u.id !== user?.id));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleTransfer = async () => {
    if (!selectedUser || !amount || Number(amount) < 1) return;
    setLoading(true);
    try {
      const { data } = await api.post('/wallet/transfer', {
        toUserId: selectedUser.id,
        amount: Number(amount),
      });
      setSuccess({ received: data.received });
      if (user) setUser({ ...user, plsBalance: data.balance } as any);
    } catch (err: any) {
      const msg = err.response?.data?.message || t('wallet.transferError');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const balance = BigInt((user as any)?.plsBalance || '0');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-500">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-primary-500" />
            <h3 className="font-semibold">{t('wallet.transfer')}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {success ? (
            <div className="text-center space-y-3 py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                <Check size={28} className="text-green-500" />
              </div>
              <p className="font-medium">{t('wallet.transferSuccess')}</p>
              <p className="text-sm text-gray-400">
                {success.received || amount} PLS → @{selectedUser?.username}
              </p>
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          ) : (
            <>
              {/* Выбор получателя */}
              {!selectedUser ? (
                <div className="space-y-2">
                  <label className="block text-sm text-gray-400">{t('wallet.transferTo')}</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder={t('wallet.searchUser')}
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                  </div>
                  {searching && <p className="text-xs text-gray-500">{t('common.loading')}</p>}
                  {searchResults.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => { setSelectedUser({ id: u.id, username: u.username }); setSearchResults([]); setSearchQuery(''); }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {u.username[0].toUpperCase()}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium">@{u.username}</p>
                            {u.displayName && <p className="text-xs text-gray-400">{u.displayName}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Выбранный получатель */}
                  <div className="flex items-center justify-between bg-gray-100 dark:bg-dark-600 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
                        {selectedUser.username[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">@{selectedUser.username}</span>
                    </div>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>

                  {/* Сумма */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">{t('wallet.transferAmount')}</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      min={1}
                      className="w-full px-4 py-2.5 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500 font-mono text-lg"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {t('wallet.plsBalance')}: {balance.toLocaleString()} PLS
                    </p>
                    {amount && Number(amount) >= 1 && (() => {
                      const amt = BigInt(Math.floor(Number(amount)));
                      const rawFee = amt * 2n / 100n;
                      const fee = rawFee < 1n ? 1n : rawFee > 10000n ? 10000n : rawFee;
                      const received = amt - fee;
                      return (
                        <div className="mt-2 p-2.5 bg-amber-500/10 rounded-lg space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">{t('wallet.fee')} 🔥</span>
                            <span className="text-amber-500 font-mono">−{fee.toLocaleString()} PLS</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">{t('wallet.youWillReceive')}</span>
                            <span className="text-green-400 font-mono font-medium">{received.toLocaleString()} PLS</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Кнопка перевода */}
                  <button
                    onClick={handleTransfer}
                    disabled={loading || !amount || Number(amount) < 1 || BigInt(Math.floor(Number(amount))) > balance}
                    className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                  >
                    {loading ? t('common.loading') : t('wallet.transferButton')}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
