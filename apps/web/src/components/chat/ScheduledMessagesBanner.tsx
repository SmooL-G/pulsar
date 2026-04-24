import { useEffect, useState } from 'react';
import { Clock, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';

interface Scheduled {
  id: string;
  chatId: string;
  content: string | null;
  type: string;
  attachments: { fileName: string; mimeType: string }[] | null;
  sendAt: string;
  createdAt: string;
}

interface Props {
  chatId: string;
}

export function ScheduledMessagesBanner({ chatId }: Props) {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<Scheduled[]>([]);
  const [expanded, setExpanded] = useState(false);

  // Refresh on mount + when chat switches + every 60s while open.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data } = await api.get('/messages/scheduled', { params: { chatId } });
        if (alive) setItems(data.scheduled || []);
      } catch { /* silent */ }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(id); };
  }, [chatId]);

  if (items.length === 0) return null;

  const cancel = async (id: string) => {
    try {
      await api.delete(`/messages/scheduled/${id}`);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch { /* silent */ }
  };

  const formatWhen = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const time = d.toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `${t('schedule.today')} ${time}`;
    if (isTomorrow) return `${t('schedule.tomorrow')} ${time}`;
    return d.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="px-4 pt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-medium hover:bg-primary-500/15 transition-colors"
      >
        <Clock size={12} />
        <span>{items.length} {t('schedule.scheduled')}</span>
        {expanded ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
          {items.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 border border-dark-500"
            >
              <Clock size={12} className="text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary-400 font-medium">{formatWhen(s.sendAt)}</p>
                <p className="text-xs text-gray-300 truncate">
                  {s.content || (s.attachments?.length ? `📎 ${s.attachments[0].fileName}` : t('schedule.noContent'))}
                </p>
              </div>
              <button
                onClick={() => cancel(s.id)}
                className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors shrink-0"
                title={t('common.cancel')}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
