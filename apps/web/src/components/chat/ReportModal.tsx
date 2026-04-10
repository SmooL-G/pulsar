import { useState } from 'react';
import { Flag, X, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import toast from 'react-hot-toast';

interface ReportModalProps {
  messageId: string;
  onClose: () => void;
}

const REASONS = [
  { key: 'SPAM', icon: '📢' },
  { key: 'HARASSMENT', icon: '😡' },
  { key: 'ILLEGAL', icon: '🚫' },
  { key: 'VIOLENCE', icon: '⚠️' },
  { key: 'OTHER', icon: '❓' },
] as const;

export function ReportModal({ messageId, onClose }: ReportModalProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await api.post('/moderation/report', { messageId, reason: selected });
      toast.success(t('report.sent'));
      onClose();
    } catch (err: any) {
      const code = err.response?.data?.error;
      if (code === 'ALREADY_REPORTED') toast.error(t('report.alreadyReported'));
      else toast.error(t('report.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-dark-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-500">
          <h3 className="font-semibold flex items-center gap-2">
            <Flag size={16} className="text-red-400" />
            {t('report.title')}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-sm text-gray-400 mb-3">{t('report.subtitle')}</p>
          {REASONS.map(({ key, icon }) => (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors text-left ${
                selected === key
                  ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                  : 'bg-dark-600 hover:bg-dark-500 border border-transparent text-gray-300'
              }`}
            >
              <span className="text-base">{icon}</span>
              {t(`report.reason.${key.toLowerCase()}` as any)}
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={handleSubmit}
            disabled={!selected || loading}
            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {t('report.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
