import { useState } from 'react';
import { Search, Shield, ShieldCheck, ShieldAlert, Ban, Trash2, UserCheck, ChevronDown, Gift, X, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { PulsarBadge } from '../ui/PulsarBadge';
import toast from 'react-hot-toast';

interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  walletAddress: string;
  walletType: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  verificationLevel: number;
  isOnline: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

export function AdminUsers() {
  const { t } = useI18n();
  const { user: currentUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rewardUser, setRewardUser] = useState<{ id: string; username: string } | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const limit = 15;

  const searchUsers = async (query?: string, newOffset = 0) => {
    setLoading(true);
    try {
      const q = query ?? search;
      const { data } = await api.get(`/admin/users?q=${encodeURIComponent(q)}&limit=${limit}&offset=${newOffset}`);
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setOffset(newOffset);
    } catch {
      toast.error('Failed to load users');
    }
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers(search, 0);
  };

  const changeRole = async (userId: string, role: string) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast.success(t('admin.roleChanged'));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const changeVerification = async (userId: string, level: number) => {
    try {
      await api.patch(`/admin/users/${userId}/verification`, { level });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, verificationLevel: level } : u)));
      toast.success(t('admin.verificationChanged'));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const toggleBan = async (userId: string, currentStatus: string) => {
    const banned = currentStatus !== 'BANNED';
    try {
      await api.patch(`/admin/users/${userId}/ban`, { banned });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: banned ? 'BANNED' : 'ACTIVE' } : u)));
      toast.success(banned ? t('admin.userBanned') : t('admin.userUnbanned'));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTotal((prev) => prev - 1);
      toast.success(t('admin.userDeleted'));
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error');
    }
  };

  const roleColors: Record<string, string> = {
    USER: 'bg-gray-500/20 text-gray-400',
    MODERATOR: 'bg-blue-500/20 text-blue-400',
    ADMIN: 'bg-amber-500/20 text-amber-400',
    SUPER_ADMIN: 'bg-red-500/20 text-red-400',
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'text-green-400',
    BANNED: 'text-red-400',
    SUSPENDED: 'text-amber-400',
    DELETED: 'text-gray-500',
  };

  const maxVerLevel = isSuperAdmin ? 3 : 2;

  return (
    <div className="space-y-3">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={t('admin.searchUsers')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg bg-gray-100 dark:bg-dark-600 border-none outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
        />
      </form>

      {/* User list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">
          {search ? t('admin.noResults') : t('admin.searchPrompt')}
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400 px-1">{t('admin.found')}: {total}</p>
          <div className="space-y-1.5">
            {users.map((u) => {
              const isExpanded = expandedId === u.id;
              const isSelf = u.id === currentUser?.id;

              return (
                <div key={u.id} className="bg-gray-50 dark:bg-dark-600 rounded-xl overflow-hidden">
                  {/* User row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : u.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-dark-500/50 transition-colors"
                  >
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          u.username[0].toUpperCase()
                        )}
                      </div>
                      {u.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-dark-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{u.displayName || u.username}</span>
                        <PulsarBadge level={u.verificationLevel} size={12} />
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleColors[u.role]}`}>
                          {u.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">@{u.username} · {u.walletAddress.slice(0, 6)}...{u.walletAddress.slice(-4)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] ${statusColors[u.status]}`}>{u.status}</span>
                      <ChevronDown size={14} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded actions */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-dark-500 space-y-3">
                      {/* Info */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Email</span>
                          <p className="truncate">{u.email || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">{t('admin.registered')}</span>
                          <p>{new Date(u.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Wallet</span>
                          <p className="font-mono truncate">{u.walletAddress}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">{t('admin.lastSeen')}</span>
                          <p>{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString() : '—'}</p>
                        </div>
                      </div>

                      {!isSelf && (
                        <div className="flex flex-wrap gap-2">
                          {/* Role change */}
                          {(isSuperAdmin || (currentUser?.role === 'ADMIN' && u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN')) && (
                            <select
                              value={u.role}
                              onChange={(e) => changeRole(u.id, e.target.value)}
                              className="text-xs bg-gray-100 dark:bg-dark-700 rounded-lg px-2 py-1.5 border border-gray-300 dark:border-dark-500 outline-none text-gray-900 dark:text-gray-100"
                            >
                              <option value="USER">USER</option>
                              <option value="MODERATOR">MODERATOR</option>
                              {isSuperAdmin && <option value="ADMIN">ADMIN</option>}
                              {isSuperAdmin && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
                            </select>
                          )}

                          {/* Verification */}
                          <select
                            value={u.verificationLevel}
                            onChange={(e) => changeVerification(u.id, parseInt(e.target.value))}
                            className="text-xs bg-gray-100 dark:bg-dark-700 rounded-lg px-2 py-1.5 border border-gray-300 dark:border-dark-500 outline-none text-gray-900 dark:text-gray-100"
                          >
                            {Array.from({ length: maxVerLevel + 1 }, (_, i) => (
                              <option key={i} value={i}>✦ Lv.{i}</option>
                            ))}
                          </select>

                          {/* Ban/Unban */}
                          {u.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => toggleBan(u.id, u.status)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                                u.status === 'BANNED'
                                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                              }`}
                            >
                              {u.status === 'BANNED' ? t('admin.unban') : t('admin.ban')}
                            </button>
                          )}

                          {/* Reward */}
                          <button
                            onClick={() => setRewardUser({ id: u.id, username: u.username })}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 transition-colors"
                          >
                            <Gift size={12} className="inline mr-1" />
                            {t('admin.giveReward')}
                          </button>

                          {/* Delete */}
                          {isSuperAdmin && u.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => { if (confirm(t('admin.confirmDelete'))) deleteUser(u.id); }}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
                            >
                              <Trash2 size={12} className="inline mr-1" />
                              {t('admin.delete')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => searchUsers(search, offset - limit)}
                disabled={offset === 0}
                className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-dark-600 rounded-lg disabled:opacity-30"
              >
                ← {t('admin.prev')}
              </button>
              <span className="text-xs text-gray-400 py-1.5">
                {offset + 1}–{Math.min(offset + limit, total)} / {total}
              </span>
              <button
                onClick={() => searchUsers(search, offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-dark-600 rounded-lg disabled:opacity-30"
              >
                {t('admin.next')} →
              </button>
            </div>
          )}
        </>
      )}
      {/* Reward Modal */}
      {rewardUser && (
        <AdminRewardModal
          userId={rewardUser.id}
          username={rewardUser.username}
          onClose={() => setRewardUser(null)}
          t={t}
        />
      )}
    </div>
  );
}

function AdminRewardModal({ userId, username, onClose, t }: { userId: string; username: string; onClose: () => void; t: (k: string) => string }) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const presets = [100, 500, 1000, 5000, 10000];

  const handleReward = async () => {
    const num = parseInt(amount);
    if (!num || num <= 0) return;
    setLoading(true);
    try {
      await api.post('/admin/reward', { userId, amount: num, description: description || `Reward for @${username}` });
      setSuccess(true);
      toast.success(`+${num.toLocaleString()} PLS → @${username}`);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-dark-500">
          <h3 className="font-semibold flex items-center gap-2">
            <Gift size={18} className="text-amber-400" />
            {t('admin.giveReward')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <Gift size={28} className="text-amber-400" />
              </div>
              <p className="font-bold text-lg text-amber-500">+{parseInt(amount).toLocaleString()} PLS</p>
              <p className="text-sm text-gray-400 mt-1">→ @{username}</p>
            </div>
          ) : (
            <>
              <div className="bg-gray-100 dark:bg-dark-600 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                  {username[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-sm font-medium">@{username}</span>
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1.5">{t('admin.rewardAmount')}</label>
                <input
                  type="number" min="1" max="1000000" value={amount}
                  onChange={(e) => setAmount(e.target.value)} placeholder="0"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-dark-600 rounded-lg text-lg font-mono border-none outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {presets.map((p) => (
                  <button key={p} onClick={() => setAmount(p.toString())}
                    className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 rounded-lg transition-colors text-amber-500"
                  >{p.toLocaleString()} PLS</button>
                ))}
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1.5">{t('admin.rewardReason')}</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('admin.rewardReasonPlaceholder')}
                  className="w-full px-4 py-2.5 bg-gray-100 dark:bg-dark-600 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button onClick={handleReward} disabled={!amount || parseInt(amount) <= 0 || loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {t('admin.sendReward')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
