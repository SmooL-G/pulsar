import { useState } from 'react';
import { Send, AlertTriangle, FileWarning } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import toast from 'react-hot-toast';

export function AdminContent() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-5">
      {/* Announcements (SUPER_ADMIN) */}
      {isSuperAdmin && <AnnouncementForm />}

      {/* Reports placeholder */}
      <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-amber-400" />
          <p className="text-sm font-medium">{t('admin.reports')}</p>
        </div>
        <p className="text-xs text-gray-400 py-6 text-center">{t('admin.reportsEmpty')}</p>
      </div>

      {/* Moderation log placeholder */}
      <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileWarning size={16} className="text-gray-400" />
          <p className="text-sm font-medium">{t('admin.moderationLog')}</p>
        </div>
        <p className="text-xs text-gray-400 py-6 text-center">{t('admin.noActions')}</p>
      </div>
    </div>
  );
}

function AnnouncementForm() {
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    // Placeholder — will be connected to socket broadcast
    toast.success(t('admin.announcementSent'));
    setMessage('');
    setSending(false);
  };

  return (
    <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Send size={16} className="text-primary-400" />
        <p className="text-sm font-medium">{t('admin.announcement')}</p>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('admin.announcementPlaceholder')}
        rows={3}
        maxLength={1000}
        className="w-full px-3 py-2 bg-dark-700 rounded-lg text-sm border-none outline-none focus:ring-2 focus:ring-primary-500 resize-none mb-2"
      />
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-500">{message.length}/1000</span>
        <button
          onClick={send}
          disabled={sending || !message.trim()}
          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {t('admin.sendAll')}
        </button>
      </div>
    </div>
  );
}
