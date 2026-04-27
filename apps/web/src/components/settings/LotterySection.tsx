import { useEffect, useState } from 'react';
import { Trophy, Loader2, Dice5 } from 'lucide-react';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';

interface Winner {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  nickColor: string | null;
}
interface Draw {
  id: string;
  pool: 'main' | 'small';
  amount: string;
  candidatesCount: number;
  drawnAt: string;
  winner: Winner | null;
}
interface Recent {
  mainPrize: string;
  smallPrize: string;
  minCommunitySize: number;
  cooldownDays: number;
  draws: Draw[];
}

export function LotterySection() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<Recent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/lottery/recent')
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>;
  }
  if (!data) return null;

  const ru = locale === 'ru';
  const fmtPls = (v: string) => BigInt(v).toLocaleString(ru ? 'ru-RU' : 'en-US');
  const fmtTime = (iso: string) => new Date(iso).toLocaleString(ru ? 'ru-RU' : 'en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const today = data.draws.filter((d) => {
    const ageMs = Date.now() - new Date(d.drawnAt).getTime();
    return ageMs < 24 * 3600 * 1000;
  });
  const mainToday = today.find((d) => d.pool === 'main');
  const smallToday = today.find((d) => d.pool === 'small');
  const history = data.draws.filter((d) => !today.some((t) => t.id === d.id));

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-primary-500/10 border border-amber-500/30 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={20} className="text-amber-400" />
          <h3 className="text-lg font-bold">{t('lottery.title')}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('lottery.tagline')}</p>
      </div>

      {/* Today's prizes */}
      <div className="grid grid-cols-2 gap-2">
        <PrizeTile
          icon={<Trophy size={18} />}
          label={t('lottery.main')}
          prize={fmtPls(data.mainPrize)}
          winner={mainToday?.winner}
          drawnAt={mainToday?.drawnAt}
          fmtTime={fmtTime}
          color="from-amber-500/20 to-amber-600/5 border-amber-500/40 text-amber-600 dark:text-amber-400"
          notDrawnYet={t('lottery.notDrawnYet')}
          eligibilityHint={t('lottery.mainHint').replace('{n}', String(data.minCommunitySize))}
        />
        <PrizeTile
          icon={<Dice5 size={18} />}
          label={t('lottery.small')}
          prize={fmtPls(data.smallPrize)}
          winner={smallToday?.winner}
          drawnAt={smallToday?.drawnAt}
          fmtTime={fmtTime}
          color="from-primary-500/20 to-primary-600/5 border-primary-500/40 text-primary-600 dark:text-primary-400"
          notDrawnYet={t('lottery.notDrawnYet')}
          eligibilityHint={t('lottery.smallHint')}
        />
      </div>

      {/* Rules */}
      <div className="bg-gray-50 dark:bg-dark-600/40 border border-gray-200 dark:border-dark-500 rounded-xl p-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p>• {t('lottery.ruleVerification')}</p>
        <p>• {t('lottery.ruleDailyDraw')}</p>
        <p>• {t('lottery.ruleCooldown').replace('{days}', String(data.cooldownDays))}</p>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-xs uppercase text-gray-500 font-semibold tracking-wider mb-2">
            {t('lottery.history')}
          </p>
          <div className="space-y-1.5">
            {history.slice(0, 14).map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-dark-600/40 text-xs">
                <span className={d.pool === 'main' ? 'text-amber-500' : 'text-primary-500'}>
                  {d.pool === 'main' ? '🏆' : '🎲'}
                </span>
                <span className="text-gray-600 dark:text-gray-300 flex-1 truncate" style={d.winner?.nickColor ? { color: d.winner.nickColor } : undefined}>
                  @{d.winner?.username || '—'}
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400">+{fmtPls(d.amount)}</span>
                <span className="text-gray-500 text-[10px] tabular-nums">{fmtTime(d.drawnAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PrizeTile({
  icon, label, prize, winner, drawnAt, fmtTime, color, notDrawnYet, eligibilityHint,
}: {
  icon: React.ReactNode;
  label: string;
  prize: string;
  winner: Winner | null | undefined;
  drawnAt: string | undefined;
  fmtTime: (iso: string) => string;
  color: string;
  notDrawnYet: string;
  eligibilityHint: string;
}) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${color} p-3`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-xs font-semibold">{label}</p>
      </div>
      <p className="text-xl font-bold font-mono mb-1">{prize}</p>
      <p className="text-[10px] opacity-70">PLS</p>
      <div className="mt-2 pt-2 border-t border-current/20">
        {winner ? (
          <div>
            <p className="text-xs">
              🥇 <span className="font-mono">@{winner.username}</span>
            </p>
            {drawnAt && <p className="text-[10px] opacity-60">{fmtTime(drawnAt)}</p>}
          </div>
        ) : (
          <p className="text-[11px] opacity-70">{notDrawnYet}</p>
        )}
      </div>
      <p className="text-[10px] opacity-60 mt-2">{eligibilityHint}</p>
    </div>
  );
}
