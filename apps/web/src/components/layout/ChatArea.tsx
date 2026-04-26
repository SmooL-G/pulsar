import { useState } from 'react';
import { useChatTheme } from '../../hooks/useChatTheme';
import { ArrowLeft, Info, Phone, Video, Send, Bookmark } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { ScheduledMessagesBanner } from '../chat/ScheduledMessagesBanner';
import { BotReplyKeyboard } from '../chat/BotReplyKeyboard';
import { getSocket } from '../../hooks/useSocket';
import { TransferModal } from '../wallet/TransferModal';
import { PulsarBadge } from '../ui/PulsarBadge';
import { PremiumBadge } from '../ui/PremiumBadge';
import { ProfileBadgeIcon } from '../ui/ProfileBadgeIcon';
import { NftAvatarBorder } from '../ui/NftAvatarBorder';
import { GenerativeAvatar } from '../ui/GenerativeAvatar';
import { NewsFeed } from './NewsFeed';
import { useI18n } from '../../i18n';

interface ChatAreaProps {
  onBack: () => void;
  onToggleInfo: () => void;
}

export function ChatArea({ onBack, onToggleInfo }: ChatAreaProps) {
  const { t } = useI18n();
  const setActiveChat = useChatStore((s) => s.setActiveChat);
  const activeChat = useChatStore((s) => s.activeChat);
  const [showTransfer, setShowTransfer] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  if (!activeChat) {
    return <NewsFeed />;
  }

  const isSaved = activeChat.type === 'SAVED';
  const chatName = isSaved
    ? t('chat.savedMessages')
    : activeChat.type === 'DIRECT'
      ? (activeChat as any).otherUser?.displayName ||
        (activeChat as any).otherUser?.username ||
        t('chat.directMessage')
      : activeChat.name || t('common.group');

  const wallpaper = useChatTheme();

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      setDragOver(true);
    }
  };
  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only count leaves that exit the chat area entirely.
    if (e.currentTarget === e.target) setDragOver(false);
  };
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    window.dispatchEvent(
      new CustomEvent('pulsar:files-drop', { detail: { files, chatId: activeChat.id } }),
    );
  };

  return (
    <div
      className="flex flex-col h-full relative"
      style={wallpaper.css ? { background: wallpaper.css } : undefined}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary-500/30 backdrop-blur-sm pointer-events-none border-4 border-dashed border-primary-400">
          <div className="bg-dark-700 border border-dark-500 rounded-2xl px-6 py-4 shadow-2xl">
            <p className="text-white font-semibold text-lg">{t('chat.dropToAttach')}</p>
          </div>
        </div>
      )}
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 pt-3-safe pl-safe pr-safe border-b border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-700 shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500"
        >
          <ArrowLeft size={20} />
        </button>

        {isSaved ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shrink-0">
            <Bookmark size={20} fill="currentColor" />
          </div>
        ) : (
        <NftAvatarBorder isNft={!!(activeChat as any).otherUser?.nftAvatarMint} size={40}>
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium overflow-hidden">
            {(activeChat as any).otherUser?.avatarUrl || (activeChat as any).avatarUrl ? (
              <img src={(activeChat as any).otherUser?.avatarUrl || (activeChat as any).avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <GenerativeAvatar seed={(activeChat as any).otherUser?.id || activeChat.id} size={40} />
            )}
          </div>
        </NftAvatarBorder>
        )}

        <div className="flex-1 min-w-0">
          <h2
            className="font-semibold truncate flex items-center gap-1"
            style={
              activeChat.type === 'DIRECT' && (activeChat as any).otherUser?.nickColor
                ? { color: (activeChat as any).otherUser.nickColor }
                : undefined
            }
          >
            {chatName}
            {activeChat.type === 'DIRECT' && (
              <>
                <PulsarBadge level={(activeChat as any).otherUser?.verificationLevel || 0} size={14} />
                <PremiumBadge isPremium={(activeChat as any).otherUser?.isPremium} size={14} />
                <ProfileBadgeIcon badge={(activeChat as any).otherUser?.profileBadge} size={14} />
              </>
            )}
          </h2>
          <p className="text-xs text-gray-400 truncate">
            {isSaved
              ? t('chat.savedMessagesHint')
              : activeChat.type === 'DIRECT'
                ? ((activeChat as any).otherUser?.isOnline ? t('chat.online') : t('chat.offline'))
                : activeChat.type === 'CHANNEL'
                  ? `${(activeChat as any).memberCount || 0} ${t('chat.subscribers')}`
                  : `${(activeChat as any).memberCount || 0} ${t('chat.members')}`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {activeChat.type === 'DIRECT' && (
            <button
              onClick={() => setShowTransfer(true)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-amber-500"
              title={t('wallet.transfer')}
            >
              <Send size={18} />
            </button>
          )}
          {!isSaved && (
            <>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-500">
                <Phone size={18} />
              </button>
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-500">
                <Video size={18} />
              </button>
            </>
          )}
          <button
            onClick={onToggleInfo}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-500"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      <MessageList
        chatId={activeChat.id}
        chatType={activeChat.type as 'DIRECT' | 'GROUP' | 'CHANNEL' | 'SAVED'}
        otherUserId={(activeChat as any).otherUser?.id}
        otherUserIsBot={!!(activeChat as any).otherUser?.isBot}
        onOpenComments={async (commentChatId) => {
          try {
            const res = await import('../../services/api').then(m => m.api.get(`/chats/${commentChatId}`));
            if (res.data) setActiveChat(res.data);
          } catch { /* chat will be fetched on next load */ }
        }}
      />
      {(activeChat as any).otherUser?.isBot && (
        <BotReplyKeyboard
          chatId={activeChat.id}
          onSendText={(text) => {
            const socket = getSocket();
            if (socket?.connected) {
              socket.emit('message:send', { chatId: activeChat.id, content: text, type: 'TEXT' });
            }
          }}
        />
      )}
      <ScheduledMessagesBanner chatId={activeChat.id} />
      <MessageInput
        chatId={activeChat.id}
        chatType={activeChat.type as 'DIRECT' | 'GROUP' | 'SAVED'}
        recipientUserId={(activeChat as any).otherUser?.id}
        recipientIsBot={!!(activeChat as any).otherUser?.isBot}
      />

      {showTransfer && (
        <TransferModal
          onClose={() => setShowTransfer(false)}
          prefillUserId={(activeChat as any).otherUser?.id}
        />
      )}
    </div>
  );
}
