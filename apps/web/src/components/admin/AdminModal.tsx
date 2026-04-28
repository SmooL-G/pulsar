import { X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { AdminPanel } from './AdminPanel';

interface AdminModalProps {
  onClose: () => void;
}

export function AdminModal({ onClose }: AdminModalProps) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-2 md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-dark-700 rounded-2xl w-full max-w-5xl max-h-[95vh] md:max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 dark:border-dark-500 shrink-0">
          <h3 className="font-semibold text-lg">{t('admin.title')}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          <AdminPanel />
        </div>
      </div>
    </div>
  );
}
