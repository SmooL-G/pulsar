import { useState, useEffect, useRef } from 'react';
import { Flag, ShieldCheck, X } from 'lucide-react';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { getSocket } from '../../hooks/useSocket';
import toast from 'react-hot-toast';

interface ReportCardProps {
  reportId: string;
  reportedContent: string;
  reason: string;
  initialCounts?: Record<string, number>;
  resolved?: boolean;
}

const VERDICTS = [
  { key: 'DISMISS', label: '✅ Отклонить', color: 'text-green-400' },
  { key: 'WARN', label: '⚠️ Предупреждение', color: 'text-yellow-400' },
  { key: 'MUTE_1H', label: '🔇 Мут 1 час', color: 'text-orange-400' },
  { key: 'MUTE_24H', label: '🔇 Мут 24 часа', color: 'text-orange-500' },
  { key: 'MUTE_7D', label: '🔇 Мут 7 дней', color: 'text-red-400' },
  { key: 'BAN_30D', label: '🚫 Бан 30 дней', color: 'text-red-500' },
  { key: 'BAN_PERM', label: '💀 Перманентный бан', color: 'text-red-600' },
];

const THRESHOLD = 10;

const REASON_LABELS: Record<string, string> = {
  SPAM: '📢 Спам',
  HARASSMENT: '😡 Оскорбления',
  ILLEGAL: '🚫 Незаконный контент',
  VIOLENCE: '⚠️ Насилие',
  OTHER: '❓ Другое',
};

export function ReportCard({ reportId, reportedContent, reason, initialCounts = {}, resolved: initResolved = false }: ReportCardProps) {
  const { t } = useI18n();
  const [counts, setCounts] = useState(initialCounts);
  const [resolved, setResolved] = useState(initResolved);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Слушаем обновления голосов через socket
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: any) => {
      if (data.reportId !== reportId) return;
      setCounts(data.counts);
      if (data.resolved) setResolved(true);
    };
    socket.on('report:votes-updated', handler);
    return () => { socket.off('report:votes-updated', handler); };
  }, [reportId]);

  // Закрыть меню по клику снаружи
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  const handleVote = async (verdict: string) => {
    setContextMenu(null);
    setLoading(true);
    try {
      const { data } = await api.post('/moderation/vote', { reportId, verdict });
      setMyVote(verdict);
      setCounts(data.counts);
      if (data.resolved) {
        setResolved(true);
        toast.success('Решение принято — наказание применено');
      } else {
        toast.success('Голос учтён');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);
  const dominantVerdict = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div
      className={`mx-auto my-2 max-w-sm w-full rounded-2xl border shadow-lg overflow-hidden ${
        resolved
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-red-500/30 bg-red-500/5'
      }`}
      onContextMenu={(e) => {
        if (resolved) return;
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 250) });
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border-b border-red-500/20">
        <Flag size={13} className="text-red-400 shrink-0" />
        <span className="text-xs font-semibold text-red-400 flex-1">Жалоба · {REASON_LABELS[reason] || reason}</span>
        {resolved && <ShieldCheck size={13} className="text-green-400" />}
      </div>

      {/* Reported content — anonymized */}
      <div className="px-4 py-3">
        <p className="text-xs text-gray-400 mb-1">Сообщение (анонимно):</p>
        <p className="text-sm text-gray-200 bg-dark-700/60 rounded-xl px-3 py-2 break-words line-clamp-4">
          {reportedContent}
        </p>
      </div>

      {/* Vote counts */}
      {totalVotes > 0 && (
        <div className="px-4 pb-2 space-y-1">
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([verdict, count]) => {
              const info = VERDICTS.find((v) => v.key === verdict);
              const pct = Math.round((count / THRESHOLD) * 100);
              return (
                <div key={verdict} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-28 truncate ${info?.color || 'text-gray-400'}`}>{info?.label || verdict}</span>
                  <div className="flex-1 h-1.5 bg-dark-500 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-current rounded-full transition-all"
                      style={{ width: `${Math.min(pct, 100)}%`, color: 'inherit' }}
                    />
                  </div>
                  <span className="text-gray-400 w-8 text-right">{count}/{THRESHOLD}</span>
                </div>
              );
            })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-dark-500 flex items-center justify-between">
        <span className="text-[10px] text-gray-500">
          {resolved ? 'Решение принято' : myVote ? `Ваш голос: ${VERDICTS.find(v => v.key === myVote)?.label}` : 'ПКМ → выбрать вердикт'}
        </span>
        <span className="text-[10px] text-gray-500">{totalVotes} голосов</span>
      </div>

      {/* Verdict context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1.5 min-w-[200px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <p className="px-4 py-1 text-[10px] text-gray-500 uppercase tracking-wider">Вердикт</p>
          {VERDICTS.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => handleVote(key)}
              disabled={loading}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-dark-600 transition-colors ${color}`}
            >
              {label}
              {counts[key] ? <span className="ml-auto text-gray-500 text-[10px]">{counts[key]}/{THRESHOLD}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
