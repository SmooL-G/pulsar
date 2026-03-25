import { Coins, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useI18n } from '../../i18n';

export function AdminFinance() {
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      {/* Platform balance placeholder */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Coins size={20} />
          <span className="font-medium">{t('admin.platformBalance')}</span>
        </div>
        <p className="text-3xl font-bold font-mono">0.000 SOL</p>
        <p className="text-xs opacity-60 mt-1">{t('admin.balancePlaceholder')}</p>
      </div>

      {/* Verification transactions placeholder */}
      <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-4">
        <p className="text-sm font-medium mb-3">{t('admin.verificationTx')}</p>
        <div className="space-y-2">
          <p className="text-xs text-gray-400 py-6 text-center">{t('admin.noTransactions')}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowUpRight size={14} className="text-green-400" />
            <span className="text-xs text-gray-400">{t('admin.income')}</span>
          </div>
          <p className="text-lg font-bold font-mono">0.000 SOL</p>
        </div>
        <div className="bg-gray-50 dark:bg-dark-600 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownRight size={14} className="text-red-400" />
            <span className="text-xs text-gray-400">{t('admin.expenses')}</span>
          </div>
          <p className="text-lg font-bold font-mono">0.000 SOL</p>
        </div>
      </div>
    </div>
  );
}
