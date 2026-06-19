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

  const text = current.message.content
    || (current.message.type === 'VOICE' ? `🎤 ${t('voice.message') || 'Голосовое'}`
        : current.message.type === 'FILE' || current.message.type === 'IMAGE'
          ? `📎 ${t('chat.file') || 'Вложение'}`
          : t('chat.file') || 'Сообщение');
  const senderName = current.message.sender?.displayName || current.message.sender?.username || '';

  return (
    <div className="mx-2 md:mx-3 mt-2 shrink-0">
      <div
        className="
          relative flex items-stretch gap-2 px-3 py-2
          rounded-2xl overflow-hidden
          bg-white/70 dark:bg-dark-700/55 backdrop-blur-xl
          border border-white/40 dark:border-white/10
          shadow-md shadow-black/5 dark:shadow-black/20
        "
      >
        {/* Left accent stripe */}
        <span className="w-1 rounded-full bg-primary-500 shrink-0" />

        {/* Body — click jumps to source message */}
        <button
          onClick={handleScrollTo}
          className="flex-1 min-w-0 text-left hover:opacity-90 transition-opacity flex flex-col justify-center py-0.5"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <Pin size={11} className="text-primary-500 shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-500">
              {t('chat.pinnedMessage') || 'Закреплено'}
              {pinned.length > 1 && (
                <span className="ml-1.5 text-gray-400 dark:text-gray-500 normal-case tracking-normal">
                  {currentIdx + 1}/{pinned.length}
                </span>
              )}
            </span>
            {senderName && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                · {senderName}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-700 dark:text-gray-200 truncate">{text}</p>
        </button>

        {/* Nav + unpin column */}
        <div className="flex items-center gap-0.5 shrink-0">
          {pinned.length > 1 && (
            <div className="flex flex-col -mr-0.5">
              <button
                onClick={prev}
                className="text-gray-400 hover:text-primary-500 transition-colors leading-none"
                aria-label="Previous pin"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={next}
                className="text-gray-400 hover:text-primary-500 transition-colors leading-none"
                aria-label="Next pin"
              >
                <ChevronDown size={14} />
              </button>
            </div>
          )}
          {canUnpin && (
            <button
              onClick={handleUnpin}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title={t('chat.unpin') || 'Открепить'}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
