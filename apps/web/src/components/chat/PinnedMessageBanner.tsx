import { useEffect, useState } from 'react';
import { Pin, X, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../../services/api';
import { useChatStore, type PinnedMsg } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { highlightMessage } from './MessageList';

interface PinnedMessageBannerProps {
  chatId: string;
  chatType: 'DIRECT' | 'GROUP' | 'CHANNEL';
  myRole?: string;
}

export function PinnedMessageBanner({ chatId, chatType, myRole }: PinnedMessageBannerProps) {
  const { t } = useI18n();
  const { pinnedMessages, setPinnedMessages, removePinnedMessage } = useChatStore();
  const currentUser = useAuthStore((s) => s.user);
  const pinned = pinnedMessages[chatId] || [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/messages/chat/${chatId}/pinned`).then(({ data }) => {
      setPinnedMessages(chatId, data.pinned);
      setCurrentIdx(0);
    }).catch(() => {});
  }, [chatId]);

  useEffect(() => {
    setCurrentIdx((i) => Math.min(i, Math.max(0, pinned.length - 1)));
  }, [pinned.length]);

  if (pinned.length === 0) return null;

  const current: PinnedMsg = pinned[currentIdx];

  const canUnpin =
    chatType === 'DIRECT' ||
    ['OWNER', 'ADMIN', 'MODERATOR'].includes(myRole ?? '');

  const handleUnpin = async () => {
    if (!canUnpin) return;
    setLoading(true);
    try {
      await api.delete(`/messages/${current.message.id}/pin`);
      removePinnedMessage(chatId, current.message.id);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleScrollTo = () => {
    if (highlightMessage) {
      highlightMessage(current.message.id);
    }
  };

  const prev = () => setCurrentIdx((i) => (i + 1) % pinned.length);
  const next = () => setCurrentIdx((i) => (i - 1 + pinned.length) % pinned.length);

  const text = current.message.content || t('chat.file');
  const senderName = current.message.sender?.displayName || current.message.sender?.username || '';

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-700 border-b border-gray-200 dark:border-dark-500 shrink-0">
      {/* Pin icon + count */}
      <div className="flex flex-col items-center shrink-0">
        <Pin size={13} className="text-primary-400 mb-0.5" />
        {pinned.length > 1 && (
          <span className="text-[9px] text-gray-400">{currentIdx + 1}/{pinned.length}</span>
        )}
      </div>

      {/* Кликабельный контент — скролл к сообщению */}
      <div className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleScrollTo}>
        <p className="text-[10px] font-semibold text-primary-400 mb-0.5">
          {t('chat.pinnedMessage')} {senderName ? `· ${senderName}` : ''}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{text}</p>
      </div>

      {/* Навигация если несколько */}
      {pinned.length > 1 && (
        <div className="flex flex-col shrink-0">
          <button onClick={next} className="text-gray-400 hover:text-gray-200 transition-colors">
            <ChevronUp size={14} />
          </button>
          <button onClick={prev} className="text-gray-400 hover:text-gray-200 transition-colors">
            <ChevronDown size={14} />
          </button>
        </div>
      )}

      {/* Открепить */}
      {canUnpin && (
        <button
          onClick={handleUnpin}
          disabled={loading}
          className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title={t('chat.unpin')}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
