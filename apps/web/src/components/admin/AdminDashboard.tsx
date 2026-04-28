import { useEffect, useState } from 'react';
import { Users, MessageCircle, UserPlus, Wifi, MessagesSquare, UsersRound, Server, Banknote, Gift, Trophy, Zap, Radio, Vote } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';

interface DashboardData {
  userCount: number;
  onlineCount: number;
  newUsersWeek: number;
  messagesToday: number;
  totalMessages: number;
  totalGroups: number;
  messagesPerDay: { date: string; count: number }[];
  usersPerDay: { date: string; count: number }[];
}

interface SystemInfo {
  uptime: number;
  nodeVersion: string;
  platform: string;
  memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
  redisMemory: string;
}

interface BankData {
  totalSupply: string;
  distributed: string;
  bankBalance: string;
  recentRewards: { id: string; amount: string; description: string; createdAt: string; user: { username: string; displayName?: string } }[];
}

export function AdminDashboard() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [bank, setBank] = useState<BankData | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/admin/dashboard');
      setData(d);
      if (isSuperAdmin) {
        const [{ data: s }, { data: b }] = await Promise.all([
          api.get('/admin/system'),
          api.get('/admin/bank'),
        ]);
        setSystem(s);
        setBank(b);
      }
    } catch {}
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    { icon: Users, label: t('admin.totalUsers'), value: data.userCount, color: 'text-blue-400' },
    { icon: Wifi, label: t('admin.onlineNow'), value: data.onlineCount, color: 'text-green-400' },
    { icon: UserPlus, label: t('admin.newWeek'), value: data.newUsersWeek, color: 'text-purple-400' },
    { icon: MessageCircle, label: t('admin.messagesToday'), value: data.messagesToday, color: 'text-amber-400' },
    { icon: MessagesSquare, label: t('admin.totalMessages'), value: data.totalMessages, color: 'text-cyan-400' },
    { icon: UsersRound, label: t('admin.totalGroups'), value: data.totalGroups, color: 'text-rose-400' },
  ];

  const maxMsg = Math.max(...data.messagesPerDay.map((d) => d.count), 1);
  const maxUsers = Math.max(...data.usersPerDay.map((d) => d.count), 1);

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const formatBytes = (b: number) => {
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-gray-50 dark:bg-dark-600 rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Icon size={16} className={color} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className="text-xl font-bold">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Messages chart */}
      <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4">
        <p className="text-sm font-medium mb-3">{t('admin.messagesChart')}</p>
        <div className="flex items-end gap-1.5 h-24">
          {data.messagesPerDay.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary-500/80 rounded-t-sm transition-all"
                style={{ height: `${(d.count / maxMsg) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
                title={`${d.count}`}
              />
              <span className="text-[9px] text-gray-500">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Users chart */}
      <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4">
        <p className="text-sm font-medium mb-3">{t('admin.usersChart')}</p>
        <div className="flex items-end gap-1.5 h-24">
          {data.usersPerDay.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-green-500/80 rounded-t-sm transition-all"
                style={{ height: `${(d.count / maxUsers) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
                title={`${d.count}`}
              />
              <span className="text-[9px] text-gray-500">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PLS Bank (SUPER_ADMIN) */}
      {isSuperAdmin && bank && (
        <div className="bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Banknote size={16} className="text-amber-400" />
            <p className="text-sm font-medium text-amber-400">{t('admin.plsBank')}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white/60 dark:bg-dark-700/60 rounded-lg p-2.5">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">{t('admin.bankBalance')}</span>
              <p className="text-sm font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {BigInt(bank.bankBalance).toLocaleString()}
              </p>
            </div>
            <div className="bg-white/60 dark:bg-dark-700/60 rounded-lg p-2.5">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">{t('admin.distributed')}</span>
              <p className="text-sm font-bold font-mono text-emerald-600 dark:text-green-400 mt-0.5">
                {BigInt(bank.distributed).toLocaleString()}
              </p>
            </div>
            <div className="bg-white/60 dark:bg-dark-700/60 rounded-lg p-2.5">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">{t('admin.totalSupply')}</span>
              <p className="text-sm font-bold font-mono text-gray-800 dark:text-gray-300 mt-0.5">
                22Q
              </p>
            </div>
          </div>

          {/* Recent rewards */}
          {bank.recentRewards.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                <Gift size={12} />
                {t('admin.recentRewards')}
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-hidden">
                {bank.recentRewards.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs bg-white/60 dark:bg-dark-700/40 rounded-lg px-2.5 py-1.5">
                    <span className="text-gray-800 dark:text-gray-300 flex items-center gap-1">@{r.user.username}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-mono font-medium">+{BigInt(r.amount).toLocaleString()} PLS</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bank distribution controls (admin/super_admin) */}
      <LotteryToggle />
      <ActivityToggle />
      <RevenueToggle />
      <TreasuryToggle />

      {/* System info (SUPER_ADMIN) */}
      {isSuperAdmin && system && (
        <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server size={16} className="text-gray-400" />
            <p className="text-sm font-medium">{t('admin.systemInfo')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-2.5">
              <span className="text-gray-400">Uptime</span>
              <p className="font-mono mt-0.5">{formatUptime(system.uptime)}</p>
            </div>
            <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-2.5">
              <span className="text-gray-400">Node.js</span>
              <p className="font-mono mt-0.5">{system.nodeVersion}</p>
            </div>
            <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-2.5">
              <span className="text-gray-400">Heap</span>
              <p className="font-mono mt-0.5">{formatBytes(system.memoryUsage.heapUsed)} / {formatBytes(system.memoryUsage.heapTotal)}</p>
            </div>
            <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-2.5">
              <span className="text-gray-400">Redis</span>
              <p className="font-mono mt-0.5">{system.redisMemory}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RevenueToggle() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/revenue/status').then(({ data }) => setEnabled(!!data.enabled)).catch(() => {});
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    setBusy(true);
    try {
      const { data } = await api.post('/revenue/toggle', { enabled: !enabled });
      setEnabled(!!data.enabled);
    } catch { /* silent */ } finally { setBusy(false); }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border border-indigo-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Radio size={16} className="text-indigo-500" />
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">{t('admin.revenueControl')}</p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('admin.revenueControlHint')}</p>
          <p className="text-[11px] mt-1">
            {enabled === null ? '…' : enabled
              ? <span className="text-emerald-500 font-semibold">● {t('admin.lotteryOn')}</span>
              : <span className="text-gray-500 font-semibold">○ {t('admin.lotteryOff')}</span>}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || enabled === null}
          className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-500'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function ActivityToggle() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/lottery/activity/status').then(({ data }) => setEnabled(!!data.enabled)).catch(() => {});
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    setBusy(true);
    try {
      const { data } = await api.post('/lottery/activity/toggle', { enabled: !enabled });
      setEnabled(!!data.enabled);
    } catch { /* silent */ } finally { setBusy(false); }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={16} className="text-emerald-500" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{t('admin.activityControl')}</p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('admin.activityControlHint')}</p>
          <p className="text-[11px] mt-1">
            {enabled === null ? '…' : enabled
              ? <span className="text-emerald-500 font-semibold">● {t('admin.lotteryOn')}</span>
              : <span className="text-gray-500 font-semibold">○ {t('admin.lotteryOff')}</span>}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || enabled === null}
          className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-500'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function LotteryToggle() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/lottery/recent').then(({ data }) => setEnabled(!!data.enabled)).catch(() => {});
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    setBusy(true);
    try {
      const { data } = await api.post('/lottery/toggle', { enabled: !enabled });
      setEnabled(!!data.enabled);
    } catch { /* silent */ } finally { setBusy(false); }
  };

  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Trophy size={16} className="text-amber-500" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t('admin.lotteryControl')}</p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">{t('admin.lotteryControlHint')}</p>
          <p className="text-[11px] mt-1">
            {enabled === null ? '…' : enabled
              ? <span className="text-emerald-500 font-semibold">● {t('admin.lotteryOn')}</span>
              : <span className="text-gray-500 font-semibold">○ {t('admin.lotteryOff')}</span>}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || enabled === null}
          className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-500'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function TreasuryToggle() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/treasury/config').then(({ data }) => setEnabled(!!data.enabled)).catch(() => {});
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    setBusy(true);
    try {
      const { data } = await api.post('/treasury/toggle', { enabled: !enabled });
      setEnabled(!!data.enabled);
    } catch { /* silent */ } finally { setBusy(false); }
  };

  return (
    <div className="bg-gradient-to-br from-violet-500/10 to-violet-600/5 border border-violet-500/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Vote size={16} className="text-violet-500" />
        <p className="text-sm font-medium text-violet-700 dark:text-violet-400">
          {ru ? 'Голосования сообщества' : 'Community votes'}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {ru
              ? 'Создание новых предложений и приём голосов. Активные голосования продолжатся.'
              : 'Creation of new proposals and accepting votes. Active votes continue.'}
          </p>
          <p className="text-[11px] mt-1">
            {enabled === null ? '…' : enabled
              ? <span className="text-emerald-500 font-semibold">● {ru ? 'Включено' : 'On'}</span>
              : <span className="text-gray-500 font-semibold">○ {ru ? 'Отключено' : 'Off'}</span>}
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || enabled === null}
          className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-500'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </div>
  );
}
