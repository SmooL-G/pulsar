import { useEffect, useState } from 'react';
import { Search, Plus, Settings, LogOut, Users, Globe, Wallet } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { ChatListItem } from '../chat/ChatListItem';
import { NewChatModal } from '../chat/NewChatModal';
import { ProfilePanel } from '../profile/ProfilePanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { FriendsPanel } from '../friends/FriendsPanel';
import { LanguageSelector } from '../settings/LanguageSelector';
import { WalletPanel } from '../wallet/WalletPanel';
import { PulsarBadge } from '../ui/PulsarBadge';
import { useI18n } from '../../i18n';

interface SidebarProps {
  onChatSelect: () => void;
}

export function Sidebar({ onChatSelect }: SidebarProps) {
  const { t, locale, setLocale } = useI18n();
  const { chats, fetchChats, setActiveChat, activeChat } = useChatStore();
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const filteredChats = searchQuery
    ? chats.filter(
        (chat) =>
          chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (chat as any).otherUser?.username
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
    : chats;

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-dark-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-500">
        <h1 className="text-xl font-bold text-primary-600">Pulsar</h1>
        <div className="flex items-center gap-1">
          {/* Language toggle */}
          <button
            onClick={() => setShowLang(true)}
            className="px-2 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors text-xs font-medium text-gray-500"
            title={t('settings.language')}
          >
            {locale.toUpperCase()}
          </button>
          <button
            onClick={() => setShowWallet(true)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
            title={t('profile.wallet')}
          >
            <Wallet size={20} />
          </button>
          <button
            onClick={() => setShowFriends(true)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
            title={t('friends.title')}
          >
            <Users size={20} />
          </button>
          <button
            onClick={() => setShowNewChat(true)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
            title={t('chat.newChat')}
          >
            <Plus size={20} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
            title={t('settings.title')}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder={t('chat.searchChats')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-200 dark:bg-dark-600
              border-none outline-none focus:ring-2 focus:ring-primary-500
              text-gray-900 dark:text-gray-100 placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {filteredChats.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={activeChat?.id === chat.id}
            onClick={() => {
              setActiveChat(chat);
              onChatSelect();
            }}
          />
        ))}
        {filteredChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <p className="text-sm">{t('chat.noChats')}</p>
            <p className="text-xs mt-1">{t('chat.startConversation')}</p>
          </div>
        )}
      </div>

      {/* User info */}
      {user && (
        <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-dark-500">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium overflow-hidden shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                user.username[0].toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate flex items-center gap-1">
                {user.displayName || user.username}
                <PulsarBadge level={(user as any).verificationLevel || 0} size={13} />
              </p>
              <p className="text-xs text-gray-400 truncate font-mono">
                {user.walletAddress.slice(0, 4)}...{user.walletAddress.slice(-4)}
              </p>
            </div>
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors text-gray-400"
            title={t('settings.logout')}
          >
            <LogOut size={18} />
          </button>
        </div>
      )}

      {/* Modals */}
      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showFriends && <FriendsPanel onClose={() => setShowFriends(false)} />}
      {showWallet && <WalletPanel onClose={() => setShowWallet(false)} />}
      {showLang && <LanguageSelector onClose={() => setShowLang(false)} />}
    </div>
  );
}
