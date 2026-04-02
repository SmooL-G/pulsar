import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';
import { NftAvatarBorder } from '../ui/NftAvatarBorder';
import { PulsarBadge } from '../ui/PulsarBadge';
import { ProfileBadgeIcon } from '../ui/ProfileBadgeIcon';
import { formatDistanceToNow } from 'date-fns';
import { ru as ruLocale } from 'date-fns/locale/ru';
import { MessageCircle, Users } from 'lucide-react';
import type { Chat } from '@pulsar/shared';

export function NewsFeed() {
  const { t, locale } = useI18n();
  const { chats, setActiveChat } = useChatStore();
  const user = useAuthStore((s) => s.user);

  // Sort chats by last message time, take those with messages
  const feed = [...chats]
    .filter((c) => c.lastMessage)
    .sort((a, b) =>
      new Date(b.lastMessage!.createdAt).getTime() -
      new Date(a.lastMessage!.createdAt).getTime()
    );

  const noMessages = chats.length === 0 || feed.length === 0;

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-dark-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-700 shrink-0">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          {t('feed.title')}
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">{t('feed.subtitle')}</p>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {noMessages ? (
          <EmptyState t={t} />
        ) : (
          feed.map((chat) => (
            <FeedItem
              key={chat.id}
              chat={chat}
              locale={locale}
              currentUserId={user?.id}
              onClick={() => setActiveChat(chat)}
              t={t}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FeedItem({
  chat,
  locale,
  currentUserId,
  onClick,
  t,
}: {
  chat: Chat & { otherUser?: any; ownerId?: string };
  locale: string;
  currentUserId?: string;
  onClick: () => void;
  t: (k: string) => string;
}) {
  const msg = chat.lastMessage!;
  const isGroup = chat.type === 'GROUP';
  const isOwn = msg.senderId === currentUserId;

  const name = isGroup
    ? chat.name || t('common.group')
    : (chat as any).otherUser?.displayName || (chat as any).otherUser?.username || t('common.unknown');

  const senderName = isGroup
    ? isOwn
      ? t('chat.you')
      : msg.sender?.displayName || msg.sender?.username || ''
    : isOwn
      ? t('chat.you')
      : name;

  const preview =
    msg.type === 'IMAGE'
      ? `📷 ${t('chat.photo')}`
      : msg.type === 'FILE'
        ? `📎 ${t('chat.file')}`
        : msg.content || '🔒';

  const time = formatDistanceToNow(new Date(msg.createdAt), {
    addSuffix: true,
    locale: locale === 'ru' ? ruLocale : undefined,
  });

  const avatarSeed = isGroup ? chat.id : (chat as any).otherUser?.id || chat.id;
  const avatarUrl = isGroup ? (chat as any).avatarUrl : (chat as any).otherUser?.avatarUrl;
  const isNft = !isGroup && !!(chat as any).otherUser?.nftAvatarMint;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-3 p-3.5 bg-white dark:bg-dark-700 rounded-2xl hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors text-left shadow-sm border border-gray-100 dark:border-dark-600"
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <NftAvatarBorder isNft={isNft} size={44}>
          <div className="w-11 h-11 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <GenerativeAvatar seed={avatarSeed} size={44} />
            )}
          </div>
        </NftAvatarBorder>
        {/* Group / DM icon */}
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-dark-700 flex items-center justify-center border border-gray-200 dark:border-dark-500">
          {isGroup
            ? <Users size={9} className="text-primary-500" />
            : <MessageCircle size={9} className="text-primary-400" />}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-medium text-sm truncate flex items-center gap-1">
            {name}
            {!isGroup && (
              <>
                <PulsarBadge level={(chat as any).otherUser?.verificationLevel || 0} size={12} />
                <ProfileBadgeIcon badge={(chat as any).otherUser?.profileBadge} size={12} />
              </>
            )}
          </span>
          <span className="text-[11px] text-gray-400 shrink-0">{time}</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
          <span className="font-medium text-gray-600 dark:text-gray-300">{senderName}: </span>
          {preview}
        </p>
      </div>

      {/* Unread */}
      {chat.unreadCount && chat.unreadCount > 0 ? (
        <span className="shrink-0 self-center bg-primary-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
        </span>
      ) : null}
    </button>
  );
}

function EmptyState({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
        <MessageCircle size={36} className="text-primary-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">{t('chat.welcome')}</h3>
      <p className="text-sm text-gray-400 mt-1">{t('chat.selectChat')}</p>
    </div>
  );
}
