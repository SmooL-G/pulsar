import { useEffect, useState } from 'react';
import { Coins, Lock, Loader2, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import toast from 'react-hot-toast';

interface Tier {
  lockDays: number;
  apyBps: number;
}
interface PoolInfo {
  tiers: Tier[];
  poolTotal: string;
  poolUsed: string;
  poolRemaining: string;
  minStake: string;
  maxStakePerUser: string;
  earlyPenaltyBps: number;
}
interface Stake {
  id: string;
  amount: string;
  lockDays: number;
  apyBps: number;
  startedAt: string;
  maturesAt: string;
  status: 'ACTIVE' | 'WITHDRAWN' | 'EARLY_WITHDRAWN';
  withdrawnAt: string | null;
  withdrawnAmount: string | null;
  rewardPaid: string | null;
  rewardEstimate: string;
  matured: boolean;
}

export function StakingSection() {
  const { t, locale } = useI18n();
  const { user, setUser } = useAuthStore();
  const [pool, setPool] = useState<PoolInfo | null>(null);
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickerTier, setPickerTier] = useState<Tier | null>(null);

  const reload = async () => {
    try {
      const [tiersRes, myRes] = await Promise.all([
        api.get('/staking/tiers'),
        api.get('/staking/my'),
      ]);
      setPool(tiersRes.data);
      setStakes(myRes.data.stakes || []);
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const refreshUser = async () => {
    try { const { data } = await api.get('/auth/me'); setUser(data); } catch {}
  };

  const balance = BigInt((user as any)?.plsBalance || '0');
  const ru = locale === 'ru';

  const fmtPls = (v: string | bigint) => BigInt(v).toLocaleString(ru ? 'ru-RU' : 'en-US');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-primary-500/10 border border-amber-500/30 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Coins size={20} className="text-amber-400" />
          <h3 className="text-lg font-bold">{t('staking.title')}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('staking.tagline')}</p>
      </div>

      {/* Active stakes */}
      {stakes.filter((s) => s.status === 'ACTIVE').length > 0 && (
        <div>
          <p className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2">
            {t('staking.active')}
          </p>
          <div className="space-y-2">
            {stakes.filter((s) => s.status === 'ACTIVE').map((s) => (
              <ActiveStakeCard key={s.id} stake={s} onWithdrawn={() => { reload(); refreshUser(); }} />
            ))}
          </div>
        </div>
      )}

      {/* Tier picker */}
      <div>
        <p className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2">
          {t('staking.choosePlan')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(pool?.tiers || []).map((tier) => (
            <button
              key={tier.lockDays}
              onClick={() => setPickerTier(tier)}
              className="p-3 rounded-xl border border-gray-200 dark:border-dark-500 bg-gray-50 dark:bg-dark-600/40 hover:border-amber-500/40 transition-colors text-left"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">{tier.lockDays} {t('staking.days')}</p>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{(tier.apyBps / 100).toFixed(0)}% APY</p>
            </button>
          ))}
        </div>
      </div>

      {/* Pool stats */}
      {pool && (
        <div className="bg-gray-50 dark:bg-dark-600/40 border border-gray-200 dark:border-dark-500 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
            {t('staking.poolStatus')}
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-300">{t('staking.poolUsed')}: <span className="font-mono">{fmtPls(pool.poolUsed)}</span></span>
            <span className="text-gray-600 dark:text-gray-300">{t('staking.poolRemaining')}: <span className="font-mono text-emerald-600 dark:text-emerald-400">{fmtPls(pool.poolRemaining)}</span></span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {t('staking.maxPerUser')}: <span className="font-mono">{fmtPls(pool.maxStakePerUser)} PLS</span>
          </p>
        </div>
      )}

      {/* History */}
      {stakes.filter((s) => s.status !== 'ACTIVE').length > 0 && (
        <div>
          <p className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2">
            {t('staking.history')}
          </p>
          <div className="space-y-1.5">
            {stakes.filter((s) => s.status !== 'ACTIVE').slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-dark-600/40 text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  {s.lockDays}{t('staking.daysShort')} · {fmtPls(s.amount)} PLS
                </span>
                <span className={s.status === 'WITHDRAWN' ? 'text-emerald-600 dark:text-emerald-400 font-mono' : 'text-red-500 font-mono'}>
                  {s.status === 'WITHDRAWN' ? '+' : ''}{fmtPls(s.withdrawnAmount || '0')} PLS
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stake modal */}
      {pickerTier && pool && (
        <StakeModal
          tier={pickerTier}
          balance={balance}
          maxStakePerUser={BigInt(pool.maxStakePerUser)}
          minStake={BigInt(pool.minStake)}
          onClose={() => setPickerTier(null)}
          onCreated={() => { setPickerTier(null); reload(); refreshUser(); }}
          busy={busy}
          setBusy={setBusy}
        />
      )}
    </div>
  );
}

function ActiveStakeCard({ stake, onWithdrawn }: { stake: Stake; onWithdrawn: () => void }) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ru = locale === 'ru';

  const startMs = new Date(stake.startedAt).getTime();
  const endMs = new Date(stake.maturesAt).getTime();
  const now = Date.now();
  const progress = Math.min(100, Math.max(0, ((now - startMs) / (endMs - startMs)) * 100));
  const matured = stake.matured;

  const remainingDays = Math.max(0, Math.ceil((endMs - now) / (24 * 3600 * 1000)));

  const withdraw = async () => {
    setBusy(true);
    try {
      await api.post(`/staking/${stake.id}/withdraw`);
      toast.success(matured ? t('staking.withdrawnSuccess') : t('staking.earlyWithdrawnSuccess'));
      onWithdrawn();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('staking.withdrawFailed'));
    } finally { setBusy(false); }
  };

  const fmt = (v: string | bigint) => BigInt(v).toLocaleString(ru ? 'ru-RU' : 'en-US');

  return (
    <div className={`p-3 rounded-xl border ${matured ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-gray-200 dark:border-dark-500 bg-gray-50 dark:bg-dark-600/40'}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(stake.amount)} PLS</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {stake.lockDays} {t('staking.days')} · {(stake.apyBps / 100).toFixed(0)}% APY · +{fmt(stake.rewardEstimate)} PLS
          </p>
        </div>
        {matured ? (
          <button
            onClick={withdraw}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : t('staking.withdraw')}
          </button>
        ) : (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock size={10} />
            {remainingDays} {t('staking.daysLeft')}
          </span>
        )}
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${matured ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {!matured && !confirming && (
        <button
          onClick={() => setConfirming(true)}
          className="mt-2 text-[10px] text-gray-500 hover:text-red-500 transition-colors"
        >
          {t('staking.earlyWithdrawAsk')}
        </button>
      )}
      {!matured && confirming && (
        <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
          <p className="text-[11px] text-red-400 mb-2 flex items-start gap-1">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" />
            {t('staking.earlyWithdrawWarning')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={withdraw}
              disabled={busy}
              className="flex-1 px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-50"
            >
              {busy ? '…' : t('staking.confirmEarly')}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-gray-300 text-xs"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StakeModal({
  tier, balance, maxStakePerUser, minStake, onClose, onCreated, busy, setBusy,
}: {
  tier: Tier;
  balance: bigint;
  maxStakePerUser: bigint;
  minStake: bigint;
  onClose: () => void;
  onCreated: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const ru = locale === 'ru';
  const [amountStr, setAmountStr] = useState('1000');

  const amount = (() => {
    try { return BigInt(amountStr.replace(/\s/g, '') || '0'); } catch { return 0n; }
  })();
  const valid = amount >= minStake && amount <= balance && amount <= maxStakePerUser;
  const reward = (amount * BigInt(tier.apyBps) * BigInt(tier.lockDays)) / (10_000n * 365n);

  const create = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await api.post('/staking/create', { amount: amount.toString(), lockDays: tier.lockDays });
      toast.success(t('staking.created'));
      onCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('staking.failed'));
    } finally { setBusy(false); }
  };

  const presets = ['100', '1000', '10000', balance.toString()];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-500 rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-dark-500">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('staking.lockFor')}</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {tier.lockDays} {t('staking.days')} · {(tier.apyBps / 100).toFixed(0)}% APY
          </p>
        </div>

        <div className="p-5 space-y-3">
          <input
            type="text"
            inputMode="numeric"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="100"
            className="w-full bg-gray-100 dark:bg-dark-600 rounded-lg px-3 py-3 text-lg font-mono outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex gap-2">
            {presets.map((p, i) => (
              <button
                key={i}
                onClick={() => setAmountStr(p)}
                className="flex-1 py-1.5 text-xs bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 rounded-lg"
              >
                {i === 3 ? t('staking.max') : Number(p).toLocaleString()}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 py-2 bg-amber-500/10 rounded-xl">
            <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
              {amount.toLocaleString(ru ? 'ru-RU' : 'en-US')} PLS
            </span>
            <span className="text-amber-500">→</span>
            <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400">
              +{reward.toLocaleString(ru ? 'ru-RU' : 'en-US')} PLS
            </span>
          </div>

          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed flex items-start gap-1">
            <Lock size={10} className="mt-0.5 shrink-0" />
            {t('staking.lockNotice', { days: tier.lockDays } as any)}
          </p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-dark-600 hover:bg-gray-200 dark:hover:bg-dark-500 text-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={create}
              disabled={!valid || busy}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 size={14} className="animate-spin inline" /> : t('staking.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
