import { ArrowLeft, Info, Phone, Video } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { PulsarBadge } from '../ui/PulsarBadge';
import { ProfileBadgeIcon } from '../ui/ProfileBadgeIcon';
import { useI18n } from '../../i18n';

interface ChatAreaProps {
  onBack: () => void;
  onToggleInfo: () => void;
}

export function ChatArea({ onBack, onToggleInfo }: ChatAreaProps) {
  const { t } = useI18n();
  const activeChat = useChatStore((s) => s.activeChat);

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-dark-800">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-primary-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
            {t('chat.welcome')}
          </h2>
          <p className="text-gray-400 mt-2 text-sm">
            {t('chat.selectChat')}
          </p>
        </div>
      </div>
    );
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-dark-500 bg-white dark:bg-dark-700 shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-500"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium">
          {chatName[0]?.toUpperCase() || '?'}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate flex items-center gap-1">
            {chatName}
            {activeChat.type === 'DIRECT' && (
              <>
                <PulsarBadge level={(activeChat as any).otherUser?.verificationLevel || 0} size={14} />
                <ProfileBadgeIcon badge={(activeChat as any).otherUser?.profileBadge} size={14} />
              </>
            )}
          </h2>
          <p className="text-xs text-gray-400">
            {activeChat.type === 'GROUP'
              ? `${(activeChat as any).memberCount || 0} ${t('chat.members')}`
              : t('chat.online')}
          </p>
        </div>

        <div className="flex items-center gap-1">
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

      <MessageList chatId={activeChat.id} />
      <MessageInput chatId={activeChat.id} />
    </div>
  );
}
