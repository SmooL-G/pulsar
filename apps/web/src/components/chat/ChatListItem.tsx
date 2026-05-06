import { useState, useEffect, useRef } from 'react';
import type { Chat } from '@pulsar/shared';
import { formatDistanceToNow } from 'date-fns';
import { ru as ruLocale } from 'date-fns/locale/ru';
import { Trash2, LogOut, Eraser, Bot, Bookmark } from 'lucide-react';
import { PulsarBadge } from '../ui/PulsarBadge';
import { PremiumBadge } from '../ui/PremiumBadge';
import { ProfileBadgeIcon } from '../ui/ProfileBadgeIcon';
import { NftAvatarBorder } from '../ui/NftAvatarBorder';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';
import { AvatarFrame } from '../ui/AvatarFrame';
import { useI18n } from '../../i18n';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';

interface ChatListItemProps {
  chat: Chat & { otherUser?: any; ownerId?: string };
  isActive: boolean;
  onClick: () => void;
}

export function ChatListItem({ chat, isActive, onClick }: ChatListItemProps) {
  const { t, locale } = useI18n();
  const { removeChat } = useChatStore();
  const userId = useAuthStore((s) => s.user?.id);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSaved = chat.type === 'SAVED';
  const name = isSaved
    ? t('chat.savedMessages')
    : chat.type === 'DIRECT'
      ? chat.otherUser?.displayName || chat.otherUser?.username || t('common.unknown')
      : chat.name || t('common.group');

  const lastMsg = chat.lastMessage;
  const time = lastMsg
    ? formatDistanceToNow(new Date(lastMsg.createdAt), {
        addSuffix: false,
        locale: locale === 'ru' ? ruLocale : undefined,
      })
    : '';

  const preview = lastMsg
    ? lastMsg.type === 'IMAGE'
      ? `📷 ${t('chat.photo')}`
      : lastMsg.type === 'FILE'
        ? `📎 ${t('chat.file')}`
        : lastMsg.content || ''
    : t('chat.noMessagesYet');

  const isOwner = chat.type === 'GROUP' && (chat as any).ownerId === userId;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Calculate position, keeping menu within viewport
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 150);
    setContextMenu({ x, y });
  };

  // Close on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  const handleDelete = async () => {
    setContextMenu(null);
    try {
      if (chat.type === 'GROUP' && !isOwner) {
        // Leave group
        await api.delete(`/chats/${chat.id}`);
      } else if (chat.type === 'GROUP' && isOwner) {
        // Delete group
        await api.delete(`/groups/${chat.id}`);
      } else {
        // Delete DM
        await api.delete(`/chats/${chat.id}`);
      }
      removeChat(chat.id);
    } catch {
      // silently fail
    }
  };

  const handleClear = async () => {
    setContextMenu(null);
    try {
      await api.delete(`/chats/${chat.id}/messages`);
      // Refresh to show empty state
      useChatStore.getState().fetchChats();
    } catch {
      // silently fail
    }
  };

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={`
          w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
          ${isActive
            ? 'bg-primary-50 dark:bg-primary-900/20'
            : 'hover:bg-gray-100 dark:hover:bg-dark-600'}
        `}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          {isSaved ? (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
              <Bookmark size={22} fill="currentColor" />
            </div>
          ) : (
          <AvatarFrame frame={(chat.otherUser as any)?.avatarFrame} size={48}>
            <NftAvatarBorder isNft={!!(chat.otherUser?.nftAvatarMint)} size={48}>
              <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium overflow-hidden">
                {chat.otherUser?.avatarUrl || chat.avatarUrl ? (
                  <img src={chat.otherUser?.avatarUrl || chat.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <GenerativeAvatar seed={chat.otherUser?.id || chat.id} size={48} />
                )}
              </div>
            </NftAvatarBorder>
          </AvatarFrame>
          )}
          {chat.type === 'DIRECT' && chat.otherUser?.isOnline && !(chat.unreadCount && chat.unreadCount > 0) && !chat.otherUser?.isBot && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-dark-700" />
          )}
          {chat.type === 'DIRECT' && chat.otherUser?.isBot && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary-500 text-white rounded-full border-2 border-white dark:border-dark-700 flex items-center justify-center">
              <Bot size={8} />
            </span>
          )}
          {chat.unreadCount && chat.unreadCount > 0 ? (
            <>
              {/* Pulsing purple ring around the avatar — instantly draws the eye. */}
              <span className="absolute inset-0 rounded-full ring-2 ring-primary-500/70 animate-pulse pointer-events-none" />
              {/* Counter pill with tabular-nums + a tiny pulse dot for liveness. */}
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1.5 bg-gradient-to-br from-primary-500 to-primary-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-dark-700 leading-none gap-1 shadow-lg shadow-primary-500/40 tabular-nums">
                <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            </>
          ) : null}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span
              className="font-medium text-sm truncate flex items-center gap-1"
              style={
                chat.type === 'DIRECT' && (chat.otherUser as any)?.nickColor
                  ? { color: (chat.otherUser as any).nickColor }
                  : undefined
              }
            >
              <span className={(chat.unreadCount ?? 0) > 0 ? 'font-bold text-gray-900 dark:text-white' : ''}>
                {name}
              </span>
              <PulsarBadge level={(chat.type === 'DIRECT' ? (chat.otherUser as any)?.verificationLevel : 0) || 0} size={13} role={chat.type === 'DIRECT' ? (chat.otherUser as any)?.role : undefined} />
              {chat.type === 'DIRECT' && <PremiumBadge isPremium={(chat.otherUser as any)?.isPremium} size={13} />}
              {chat.type === 'DIRECT' && <ProfileBadgeIcon badge={(chat.otherUser as any)?.profileBadge} size={13} />}
            </span>
            {time && (
              <span className={`text-xs shrink-0 ml-2 ${(chat.unreadCount ?? 0) > 0 ? 'text-primary-400 font-semibold' : 'text-gray-400'}`}>
                {time}
              </span>
            )}
          </div>
          <p className={`text-sm truncate mt-0.5 ${(chat.unreadCount ?? 0) > 0 ? 'text-gray-700 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
            {lastMsg?.sender && chat.type === 'GROUP' && (
              <span className="text-gray-600 dark:text-gray-300 inline-flex items-center gap-0.5">
                {lastMsg.sender.displayName || lastMsg.sender.username}
                <PulsarBadge level={(lastMsg.sender as any)?.verificationLevel || 0} size={10} role={(lastMsg.sender as any)?.role} />
                <ProfileBadgeIcon badge={(lastMsg.sender as any)?.profileBadge} size={10} />
                :{' '}
              </span>
            )}
            {preview}
          </p>
        </div>

      </button>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1.5 min-w-[180px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={handleClear}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-dark-600 transition-colors"
          >
            <Eraser size={16} className="text-gray-400" />
            {t('chat.clearHistory')}
          </button>
          {!isSaved && (
            <>
              <div className="h-px bg-dark-500 mx-2 my-1" />
              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-dark-600 transition-colors"
              >
                {chat.type === 'GROUP' && !isOwner ? (
                  <>
                    <LogOut size={16} />
                    {t('chat.leaveGroup')}
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    {chat.type === 'GROUP' ? t('chat.deleteGroup') : t('chat.deleteChat')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
