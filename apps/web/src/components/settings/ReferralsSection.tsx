import { useEffect, useState } from 'react';
import { Copy, Check, Users, Coins, Loader2, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';

interface Dashboard {
  code: string;
  totalReferrals: number;
  earnedRegistration: string;
  earnedMiningL1: string;
  earnedMiningL2: string;
  recent: Array<{
    id: string;
    type: 'REGISTRATION' | 'MINING_L1' | 'MINING_L2';
    amount: string;
    refereeId: string;
    createdAt: string;
  }>;
}

export function ReferralsSection() {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);

  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get('/referrals/mine')
      .then((r) => setData(r.data))
      .catch(() => toast.error(tx('Не удалось загрузить рефералов', 'Failed to load referrals')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary-500" size={28} />
      </div>
    );
  }
  if (!data) return null;

  const link = `${window.location.origin}/?ref=${data.code}`;
  const totalEarned =
    BigInt(data.earnedRegistration) +
    BigInt(data.earnedMiningL1) +
    BigInt(data.earnedMiningL2);

  const copy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      toast.success(tx('Скопировано', 'Copied'));
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-5">
      {/* Hero: my code + share link */}
      <div className="rounded-2xl border border-primary-500/30 bg-gradient-to-br from-primary-500/10 to-primary-700/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Gift size={18} className="text-primary-400" />
          <h3 className="font-bold text-lg">{tx('Твой реф-код', 'Your referral code')}</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {tx(
            'Получай бонус за каждого приглашённого + 10% от их майнинга навсегда (и 2% с реф-реф).',
            'Get a bonus for every signup + 10% of their mining forever (and 2% from referral-of-referral).',
          )}
        </p>
        <div className="flex items-center gap-2 bg-dark-900/60 border border-dark-500 rounded-xl p-3">
          <span className="font-mono text-2xl font-bold text-primary-300 tracking-widest flex-1 text-center">
            {data.code}
          </span>
        </div>
        <button
          onClick={copy}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-semibold text-sm transition"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied
            ? tx('Скопировано!', 'Copied!')
            : tx('Копировать ссылку-приглашение', 'Copy invite link')}
        </button>
        <p className="text-xs text-gray-500 mt-2 break-all text-center">{link}</p>
      </div>

      {/* Earnings summary */}
      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Users size={16} />}
          label={tx('Приглашено', 'Invited')}
          value={data.totalReferrals.toString()}
        />
        <Stat
          icon={<Coins size={16} />}
          label={tx('Всего PLS заработано', 'Total PLS earned')}
          value={totalEarned.toString()}
          highlight
        />
        <Stat
          label={tx('Бонусы за регистрации', 'Signup bonuses')}
          value={data.earnedRegistration}
        />
        <Stat
          label={tx('С майнинга (L1 10% + L2 2%)', 'From mining (L1 10% + L2 2%)')}
          value={(BigInt(data.earnedMiningL1) + BigInt(data.earnedMiningL2)).toString()}
        />
      </div>

      {/* Tier table */}
      <div className="rounded-2xl border border-dark-500 bg-dark-800/40 p-4">
        <h4 className="font-semibold text-sm mb-3 text-gray-300">
          {tx('Регистрационный бонус по тиру', 'Tier-based signup bonus')}
        </h4>
        <div className="space-y-1.5 text-xs">
          {[
            { tier: tx('Места 1-100', 'Slots 1-100'), bonus: '200 PLS' },
            { tier: tx('Места 101-1000', 'Slots 101-1000'), bonus: '40 PLS' },
            { tier: tx('Места 1001-10000', 'Slots 1001-10000'), bonus: '10 PLS' },
            { tier: tx('Дальше', 'After that'), bonus: tx('только % с майнинга', 'mining % only') },
          ].map((row) => (
            <div key={row.tier} className="flex justify-between">
              <span className="text-gray-400">{row.tier}</span>
              <span className="font-mono font-semibold text-primary-300">{row.bonus}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-500 mt-3">
          {tx(
            'Бонус начисляется обоим (тебе и приглашённому) когда приглашённый достигает Verification Level 1.',
            'Bonus paid to both you and your invitee when they reach Verification Level 1.',
          )}
        </p>
      </div>

      {/* Recent ledger */}
      {data.recent.length > 0 && (
        <div className="rounded-2xl border border-dark-500 bg-dark-800/40 p-4">
          <h4 className="font-semibold text-sm mb-3 text-gray-300">
            {tx('Последние начисления', 'Recent earnings')}
          </h4>
          <div className="space-y-1.5 text-xs">
            {data.recent.map((r) => (
              <div key={r.id} className="flex justify-between gap-3">
                <span className="text-gray-400 truncate">
                  {r.type === 'REGISTRATION'
                    ? tx('Регистрация', 'Signup')
                    : r.type === 'MINING_L1'
                    ? tx('Майнинг (L1, 10%)', 'Mining (L1, 10%)')
                    : tx('Майнинг (L2, 2%)', 'Mining (L2, 2%)')}{' '}
                  · {new Date(r.createdAt).toLocaleDateString(ru ? 'ru-RU' : 'en-US')}
                </span>
                <span className="font-mono font-semibold text-emerald-400">+{r.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-dark-500 bg-dark-800/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-wider mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold ${highlight ? 'text-primary-300' : 'text-gray-100'}`}>
        {value}
      </div>
    </div>
  );
}
