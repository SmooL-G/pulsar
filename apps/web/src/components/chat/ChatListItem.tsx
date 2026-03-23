import React from 'react';
import type { Chat } from '@pulsar/shared';
import { formatDistanceToNow } from 'date-fns';

interface ChatListItemProps {
  chat: Chat & { otherUser?: any };
  isActive: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const name =
    chat.type === 'DIRECT'
      ? chat.otherUser?.displayName || chat.otherUser?.username || 'Unknown'
      : chat.name || 'Group';

  const lastMsg = chat.lastMessage;
  const time = lastMsg
    ? formatDistanceToNow(new Date(lastMsg.createdAt), { addSuffix: false })
    : '';

  const preview = lastMsg
    ? lastMsg.type === 'IMAGE'
      ? '📷 Photo'
      : lastMsg.type === 'FILE'
        ? '📎 File'
        : lastMsg.content || ''
    : 'No messages yet';

  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
        ${isActive
          ? 'bg-primary-50 dark:bg-primary-900/20'
          : 'hover:bg-gray-100 dark:hover:bg-dark-600'}
      `}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
          {name[0]?.toUpperCase() || '?'}
        </div>
        {chat.type === 'DIRECT' && chat.otherUser?.isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-dark-700" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate">{name}</span>
          {time && <span className="text-xs text-gray-400 shrink-0 ml-2">{time}</span>}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {lastMsg?.sender && chat.type === 'GROUP' && (
            <span className="text-gray-600 dark:text-gray-300">
              {lastMsg.sender.displayName || lastMsg.sender.username}:{' '}
            </span>
          )}
          {preview}
        </p>
      </div>

      {/* Unread badge */}
      {chat.unreadCount && chat.unreadCount > 0 ? (
        <span className="shrink-0 bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
        </span>
      ) : null}
    </button>
  );
}
