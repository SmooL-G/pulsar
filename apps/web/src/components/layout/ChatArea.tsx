import { useState } from 'react';
import { ArrowLeft, Info, Phone, Video, Send } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { TransferModal } from '../wallet/TransferModal';
import { PulsarBadge } from '../ui/PulsarBadge';
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

  if (!activeChat) {
    return <NewsFeed />;
  }

  const chatName =
    activeChat.type === 'DIRECT'
      ? (activeChat as any).otherUser?.displayName ||
        (activeChat as any).otherUser?.username ||
        t('chat.directMessage')
      : activeChat.name || t('common.group');

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 pt-3-safe pl-safe pr-safe border-b border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-700 shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500"
        >
          <ArrowLeft size={20} />
        </button>

        <NftAvatarBorder isNft={!!(activeChat as any).otherUser?.nftAvatarMint} size={40}>
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium overflow-hidden">
            {(activeChat as any).otherUser?.avatarUrl || (activeChat as any).avatarUrl ? (
              <img src={(activeChat as any).otherUser?.avatarUrl || (activeChat as any).avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <GenerativeAvatar seed={(activeChat as any).otherUser?.id || activeChat.id} size={40} />
            )}
          </div>
        </NftAvatarBorder>

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
                <ProfileBadgeIcon badge={(activeChat as any).otherUser?.profileBadge} size={14} />
              </>
            )}
          </h2>
          <p className="text-xs text-gray-400">
            {activeChat.type === 'DIRECT'
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
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-500">
            <Phone size={18} />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500 text-gray-500">
            <Video size={18} />
          </button>
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
        chatType={activeChat.type as 'DIRECT' | 'GROUP' | 'CHANNEL'}
        otherUserId={(activeChat as any).otherUser?.id}
        otherUserIsBot={!!(activeChat as any).otherUser?.isBot}
        onOpenComments={async (commentChatId) => {
          try {
            const res = await import('../../services/api').then(m => m.api.get(`/chats/${commentChatId}`));
            if (res.data) setActiveChat(res.data);
          } catch { /* chat will be fetched on next load */ }
        }}
      />
      <MessageInput
        chatId={activeChat.id}
        chatType={activeChat.type as 'DIRECT' | 'GROUP'}
        recipientUserId={(activeChat as any).otherUser?.id}
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
