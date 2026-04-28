import { useState } from 'react';
import { BarChart3, Users, FileText, Coins, Server } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { AdminDashboard } from './AdminDashboard';
import { AdminUsers } from './AdminUsers';
import { AdminContent } from './AdminContent';
import { AdminFinance } from './AdminFinance';

type SubTab = 'dashboard' | 'users' | 'content' | 'finance';

export function AdminPanel() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [subTab, setSubTab] = useState<SubTab>('dashboard');

  if (!user) return null;
  const role = user.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const tabs: { id: SubTab; icon: typeof BarChart3; label: string; visible: boolean }[] = [
    { id: 'dashboard', icon: BarChart3, label: t('admin.dashboard'), visible: true },
    { id: 'users', icon: Users, label: t('admin.users'), visible: isAdmin },
    { id: 'content', icon: FileText, label: t('admin.content'), visible: isAdmin },
    { id: 'finance', icon: Coins, label: t('admin.finance'), visible: isSuperAdmin },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <div className="space-y-4">
      {/* Sub-tabs: scroll horizontally on narrow screens */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-dark-600 rounded-lg overflow-x-auto scrollbar-hidden">
        {visibleTabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`shrink-0 md:flex-1 py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap
              ${subTab === id ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {subTab === 'dashboard' && <AdminDashboard />}
      {subTab === 'users' && isAdmin && <AdminUsers />}
      {subTab === 'content' && isAdmin && <AdminContent />}
      {subTab === 'finance' && isSuperAdmin && <AdminFinance />}
    </div>
  );
}
