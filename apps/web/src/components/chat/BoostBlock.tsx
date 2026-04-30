import { useEffect, useState } from 'react';
import { Rocket, Loader2, TrendingUp, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';

interface Booster {
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    nickColor: string | null;
  };
  count: number;
}

interface Perks {
  fileLimitMb: number;
  emojiSlots: number;
  maxMembers: number;
  hdAvatar: boolean;
  hasBanner: boolean;
  vipSearchRank: boolean;
}

interface BoostInfo {
  chatId: string;
  activeCount: number;
  level: number;
  nextThreshold: number | null;
  perks: Perks;
  earliestExpiry: string | null;
  topBoosters: Booster[];
  cost: string;
  durationDays: number;
}

const LEVEL_COLORS = ['from-gray-500 to-gray-600', 'from-pink-500 to-rose-500', 'from-violet-500 to-fuchsia-500', 'from-amber-400 to-orange-500'];

export function BoostBlock({ chatId }: { chatId: string }) {
  const { locale } = useI18n();
  const ru = locale === 'ru';
  const tx = (r: string, e: string) => (ru ? r : e);
  const { user, setUser } = useAuthStore();
  const [info, setInfo] = useState<BoostInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const { data } = await api.get(`/boost/${chatId}`);
      setInfo(data);
    } catch { /* silent */ }
  };

  useEffect(() => { reload(); }, [chatId]);

  if (!info) {
    return (
      <div className="rounded-xl bg-gray-50 dark:bg-dark-600/50 border border-gray-200 dark:border-dark-500 p-4 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const balance = BigInt((user as any)?.plsBalance || '0');
  const cost = BigInt(info.cost);
  const canAfford = balance >= cost;
  const progress = info.nextThreshold
    ? Math.min(100, (info.activeCount / info.nextThreshold) * 100)
    : 100;

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/boost/${chatId}`);
      setInfo((prev) => prev ? { ...prev, ...data } : data);
      if (user && data.balance) setUser({ ...(user as any), plsBalance: data.balance });
      toast.success(tx('Канал забустен!', 'Boosted!'));
    } catch (err: any) {
      const code = err.response?.data?.error;
      const msg =
        code === 'INSUFFICIENT_FUNDS' ? tx('Недостаточно PLS', 'Not enough PLS') :
        code === 'NOT_MEMBER' ? tx('Сначала вступите в чат', 'Join the chat first') :
        err.response?.data?.message || tx('Ошибка', 'Error');
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const perksList: { ru: string; en: string; on: boolean }[] = [
    { ru: `📎 Файлы до ${info.perks.fileLimitMb} МБ`, en: `📎 ${info.perks.fileLimitMb} MB files`, on: true },
    { ru: `👥 До ${info.perks.maxMembers.toLocaleString('ru-RU')} участников`, en: `👥 Up to ${info.perks.maxMembers.toLocaleString('en-US')} members`, on: true },
    { ru: '✨ HD аватар', en: '✨ HD avatar', on: info.perks.hdAvatar },
    { ru: `😀 ${info.perks.emojiSlots} кастомных эмодзи`, en: `😀 ${info.perks.emojiSlots} custom emoji`, on: info.perks.emojiSlots > 0 },
    { ru: '🖼️ Баннер канала', en: '🖼️ Channel banner', on: info.perks.hasBanner },
    { ru: '⭐ VIP в поиске', en: '⭐ VIP search rank', on: info.perks.vipSearchRank },
  ];

  return (
    <div className={`rounded-xl bg-gradient-to-br ${LEVEL_COLORS[info.level]}/15 border border-current/20 p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        {info.level > 0 ? <Crown size={18} className="text-amber-400" /> : <Rocket size={18} className="text-primary-400" />}
        <h4 className="text-sm font-bold">
          {tx('Уровень буста', 'Boost level')}: <span className="font-mono">{info.level}</span>
        </h4>
        <span className="ml-auto text-[11px] text-gray-500 font-mono">
          {info.activeCount} {tx('бустов', 'boosts')}
        </span>
      </div>

      {/* Progress bar to next level */}
      {info.nextThreshold && (
        <div>
          <div className="h-2 rounded-full bg-gray-200 dark:bg-dark-500 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-400 to-pink-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
            <TrendingUp size={10} />
            {tx('До уровня', 'Until level')} {info.level + 1}: {info.activeCount}/{info.nextThreshold}
          </p>
        </div>
      )}

      {/* Perks */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {perksList.map((p) => (
          <div
            key={p.en}
            className={`px-2 py-1 rounded ${p.on ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-dark-700/40 text-gray-400 line-through'}`}
          >
            {ru ? p.ru : p.en}
          </div>
        ))}
      </div>

      {/* Top boosters */}
      {info.topBoosters.length > 0 && (
        <div>
          <p className="text-[10px] uppercase text-gray-500 font-semibold mb-1.5">
            {tx('Топ бустеры', 'Top boosters')}
          </p>
          <div className="flex flex-wrap gap-1">
            {info.topBoosters.slice(0, 5).map((b) => (
              <span
                key={b.user.id}
                className="text-[11px] px-2 py-0.5 rounded-full bg-white/40 dark:bg-dark-700/60"
                style={b.user.nickColor ? { color: b.user.nickColor } : undefined}
              >
                @{b.user.username} ×{b.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Buy button */}
      <button
        onClick={buy}
        disabled={busy || !canAfford}
        className="w-full py-2.5 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-600 hover:to-fuchsia-600 text-white disabled:opacity-40"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
        {tx(`Забустить (-${BigInt(info.cost).toLocaleString('ru-RU')} PLS / ${info.durationDays} дн)`,
            `Boost (-${BigInt(info.cost).toLocaleString('en-US')} PLS / ${info.durationDays} days)`)}
      </button>
      {!canAfford && (
        <p className="text-[10px] text-amber-400 text-center">
          {tx(`Нужно ${BigInt(info.cost).toLocaleString('ru-RU')} PLS на балансе`, `Need ${BigInt(info.cost).toLocaleString('en-US')} PLS on balance`)}
        </p>
      )}
    </div>
  );
}
