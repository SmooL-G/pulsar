import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, Settings, LogOut, Users, Globe, Wallet, Megaphone, Bot, User, MessageSquare } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { ChatListItem } from '../chat/ChatListItem';
import { NewChatModal } from '../chat/NewChatModal';
import { ProfilePanel } from '../profile/ProfilePanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { FriendsPanel } from '../friends/FriendsPanel';

import { WalletPanel } from '../wallet/WalletPanel';
import { BotPanel } from '../bot/BotPanel';
import { PulsarBadge } from '../ui/PulsarBadge';
import { PremiumBadge } from '../ui/PremiumBadge';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';
import { api } from '../../services/api';
import { useMessageStore } from '../../store/messageStore';
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

  const [showWallet, setShowWallet] = useState(false);
  const [showBots, setShowBots] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Universal search with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data);
      } catch {
        setSearchResults(null);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredChats = (searchQuery
    ? chats.filter(
        (chat) =>
          chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (chat as any).otherUser?.username
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
    : chats
  ).slice().sort((a, b) => {
    // Saved Messages is always pinned to the top.
    if (a.type === 'SAVED' && b.type !== 'SAVED') return -1;
    if (b.type === 'SAVED' && a.type !== 'SAVED') return 1;
    return 0;
  });

  const handleSearchUserClick = async (userId: string) => {
    try {
      const { data } = await api.post('/chats/direct', { targetUserId: userId });
      const chat = data.chat || data;
      addChat(chat);
      setActiveChat(chat);
      setSearchQuery('');
      onChatSelect();
    } catch { /* ignore */ }
  };

  const handleSearchChatClick = async (chatId: string, type: string) => {
    try {
      const existing = chats.find((c) => c.id === chatId);
      if (existing) {
        setActiveChat(existing);
        setSearchQuery('');
        onChatSelect();
        return;
      }

      // Subscribe/join depending on type
      if (type === 'CHANNEL') {
        await api.post(`/channels/${chatId}/subscribe`);
      } else {
        await api.post(`/groups/${chatId}/join`);
      }

      // Refresh chat list and find the new chat
      await fetchChats();
      // Small delay for store to update
      setTimeout(() => {
        const updated = useChatStore.getState().chats;
        const newChat = updated.find((c) => c.id === chatId);
        if (newChat) {
          setActiveChat(newChat);
        }
        setSearchQuery('');
        onChatSelect();
      }, 300);
    } catch {
      setSearchQuery('');
    }
  };

  const handleMessageClick = (msg: any) => {
    const chat = chats.find((c) => c.id === msg.chatId);
    if (chat) {
      setActiveChat(chat);
    }
    setSearchQuery('');
    onChatSelect();
    // Highlight after a small delay to let the chat load
    setTimeout(() => {
      useMessageStore.getState().setHighlightMessage(msg.id);
      // Scroll to message
      const el = document.getElementById(`msg-${msg.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 500);
  };

  const { addChat } = useChatStore();

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-dark-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 pt-3-safe pl-safe pr-safe border-b border-gray-200 dark:border-dark-500">
        <h1 className="text-xl font-bold text-primary-600">Pulsar</h1>
        <div className="flex items-center gap-1">
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
            onClick={() => setShowBots(true)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
            title={t('bots.title')}
          >
            <Bot size={20} />
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

      {/* Chat List / Search Results */}
      <div className="flex-1 overflow-y-auto scrollbar-hidden">
        {searchResults && searchQuery.length >= 2 ? (
          <div className="px-2 py-1">
            {searchLoading && (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500" />
              </div>
            )}

            {/* My chats matching */}
            {filteredChats.length > 0 && (
              <>
                <p className="text-[10px] uppercase text-gray-500 px-2 py-1 font-semibold">{t('chat.myChats')}</p>
                {filteredChats.map((chat) => (
                  <ChatListItem key={chat.id} chat={chat} isActive={activeChat?.id === chat.id}
                    onClick={() => { setActiveChat(chat); setSearchQuery(''); onChatSelect(); }} />
                ))}
              </>
            )}

            {/* Users */}
            {searchResults.users?.length > 0 && (
              <>
                <p className="text-[10px] uppercase text-gray-500 px-2 py-1 mt-2 font-semibold flex items-center gap-1"><User size={10} /> {t('search.users')}</p>
                {searchResults.users.map((u: any) => (
                  <button key={u.id} onClick={() => handleSearchUserClick(u.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-medium overflow-hidden shrink-0">
                      {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : <GenerativeAvatar seed={u.id} size={36} />}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1">{u.displayName || u.username} <PulsarBadge level={u.verificationLevel || 0} size={10} /></p>
                      <p className="text-[11px] text-gray-400">@{u.username}</p>
                    </div>
                    {u.isOnline && <div className="w-2 h-2 rounded-full bg-green-500 ml-auto shrink-0" />}
                  </button>
                ))}
              </>
            )}

            {/* Public Groups */}
            {searchResults.groups?.length > 0 && (
              <>
                <p className="text-[10px] uppercase text-gray-500 px-2 py-1 mt-2 font-semibold flex items-center gap-1"><Users size={10} /> {t('search.groups')}</p>
                {searchResults.groups.map((g: any) => (
                  <button key={g.id} onClick={() => handleSearchChatClick(g.id, 'GROUP')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {g.avatarUrl ? <img src={g.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" /> : <Users size={18} />}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate">{g.name}</p>
                      <p className="text-[11px] text-gray-400">{g.memberCount} {t('chat.members')}</p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Public Channels */}
            {searchResults.channels?.length > 0 && (
              <>
                <p className="text-[10px] uppercase text-gray-500 px-2 py-1 mt-2 font-semibold flex items-center gap-1"><Megaphone size={10} /> {t('search.channels')}</p>
                {searchResults.channels.map((c: any) => (
                  <button key={c.id} onClick={() => handleSearchChatClick(c.id, 'CHANNEL')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" /> : <Megaphone size={18} />}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-400">{c.memberCount} {t('chat.subscribers')}</p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Bots */}
            {searchResults.bots?.length > 0 && (
              <>
                <p className="text-[10px] uppercase text-gray-500 px-2 py-1 mt-2 font-semibold flex items-center gap-1"><Bot size={10} /> {t('search.bots')}</p>
                {searchResults.bots.map((b: any) => (
                  <button key={b.id} onClick={() => handleSearchUserClick(b.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      <Bot size={18} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate">{b.displayName || b.username}</p>
                      <p className="text-[11px] text-gray-400">@{b.username}</p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Messages */}
            {searchResults.messages?.length > 0 && (
              <>
                <p className="text-[10px] uppercase text-gray-500 px-2 py-1 mt-2 font-semibold flex items-center gap-1"><MessageSquare size={10} /> {t('search.messages')}</p>
                {searchResults.messages.map((m: any) => (
                  <button key={m.id} onClick={() => handleMessageClick(m)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-gray-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      <MessageSquare size={16} />
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-[11px] text-gray-400 truncate">
                        {m.chat?.name || m.sender?.username} &middot; {new Date(m.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-sm truncate text-gray-200">{m.content}</p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {!searchLoading && !searchResults.users?.length && !searchResults.groups?.length && !searchResults.channels?.length && !searchResults.bots?.length && !searchResults.messages?.length && filteredChats.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">{t('search.noResults')}</p>
            )}
          </div>
        ) : (
          <>
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
          </>
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
                <PulsarBadge level={(user as any).verificationLevel || 0} size={13} role={(user as any).role} />
                <PremiumBadge isPremium={(user as any).isPremium} size={13} />
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
      {showBots && <BotPanel onClose={() => setShowBots(false)} />}
    </div>
  );
}
