import { Home, MessageCircle, Users, Wallet, Settings } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useNavBadges, markVisited } from '../../hooks/useNavBadges';

/**
 * Tab bar pinned to the bottom of the authenticated app shell.
 * Same shape on mobile and desktop — the user wanted parity. Five
 * round icons, the active one gets a primary-colored ring + filled
 * background.
 */

export type Tab = 'home' | 'chat' | 'contacts' | 'wallet' | 'settings';

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  const { locale } = useI18n();
  const tx = (r: string, e: string) => (locale === 'ru' ? r : e);
  const badges = useNavBadges();

  const items: { id: Tab; icon: typeof Home; label: string; badge?: 'dot' | 'plus' | number }[] = [
    { id: 'home',     icon: Home,          label: tx('Главная',   'Home'),     badge: badges.home ? 'plus' : undefined },
    { id: 'chat',     icon: MessageCircle, label: tx('Чат',       'Chat'),     badge: badges.chat > 0 ? Math.min(badges.chat, 99) : undefined },
    { id: 'contacts', icon: Users,         label: tx('Контакты',  'Contacts'), badge: badges.contacts > 0 ? Math.min(badges.contacts, 99) : undefined },
    { id: 'wallet',   icon: Wallet,        label: tx('Кошелёк',   'Wallet'),   badge: badges.wallet ? 'plus' : undefined },
    { id: 'settings', icon: Settings,      label: tx('Настройки', 'Settings') },
  ];

  const handleClick = (id: Tab) => {
    onChange(id);
    // Reset the badge for the tab the user just opened.
    if (id === 'chat' || id === 'contacts' || id === 'wallet' || id === 'home') {
      markVisited(id);
    }
  };

  return (
    <nav
      className="
        fixed bottom-0 inset-x-0 z-[60]
        border-t border-gray-200 dark:border-dark-500
        bg-white/95 dark:bg-dark-700/95 backdrop-blur-xl
        pb-safe
      "
      aria-label={tx('Главное меню', 'Main navigation')}
    >
      <div className="flex items-center justify-around max-w-2xl mx-auto py-2 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          const badge = item.badge;
          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className="group flex flex-col items-center gap-0.5 px-3 py-1 transition-all"
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className={`
                  relative flex items-center justify-center w-11 h-11 rounded-full
                  transition-all
                  ${isActive
                    ? 'bg-primary-500/15 text-primary-500 ring-2 ring-primary-500/40 shadow-md shadow-primary-500/10'
                    : 'text-gray-500 dark:text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-dark-600'}
                `}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />

                {/* Badge — top-right of icon. Count for chat/contacts,
                    plus for home/wallet, animated red dot for chat unread. */}
                {badge !== undefined && (
                  typeof badge === 'number' ? (
                    <span
                      className={`
                        absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1
                        rounded-full bg-red-500 text-white text-[10px] font-bold
                        flex items-center justify-center
                        ring-2 ring-white dark:ring-dark-700
                        ${item.id === 'chat' ? 'animate-pulse' : ''}
                      `}
                    >
                      {badge >= 99 ? '99+' : badge}
                    </span>
                  ) : (
                    /* badge === 'plus' or 'dot' */
                    <span
                      className={`
                        absolute -top-0.5 -right-0.5 w-[18px] h-[18px]
                        rounded-full flex items-center justify-center
                        ring-2 ring-white dark:ring-dark-700
                        ${item.id === 'wallet' ? 'bg-amber-500' : 'bg-primary-500'}
                        text-white text-[12px] font-bold leading-none
                      `}
                    >
                      +
                    </span>
                  )
                )}
              </span>
              <span
                className={`
                  text-[10px] font-medium
                  ${isActive ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400'}
                `}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
