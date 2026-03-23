import React, { useEffect, useState } from 'react';
import { Search, Plus, Settings, LogOut } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { ChatListItem } from '../chat/ChatListItem';

interface SidebarProps {
  onChatSelect: () => void;
}

export function Sidebar({ onChatSelect }: SidebarProps) {
  const { chats, fetchChats, setActiveChat, activeChat } = useChatStore();
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');

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
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
            title="New chat"
          >
            <Plus size={20} />
          </button>
          <button
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors"
            title="Settings"
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
            placeholder="Search chats..."
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
            <p className="text-sm">No chats yet</p>
            <p className="text-xs mt-1">Start a new conversation</p>
          </div>
        )}
      </div>

      {/* User info */}
      {user && (
        <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-dark-500">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
            {user.username[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.displayName || user.username}</p>
            <p className="text-xs text-gray-400 truncate font-mono">
              {user.walletAddress.slice(0, 4)}...{user.walletAddress.slice(-4)}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-500 transition-colors text-gray-400"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
