import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMessageStore } from '../../store/messageStore';
import { MessageBubble } from './MessageBubble';
import { BotStartButton } from './BotStartButton';
import { DateDivider } from './DateDivider';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../hooks/useSocket';
import { useI18n } from '../../i18n';
import { isSameDay, dayLabel } from '../../utils/messageDateLabel';

/**
 * Highlight a message + scroll it into view. Imported by
 * PinnedMessageBanner so a click on a pin jumps the reader to the
 * source message. Lives here because MessageList owns the highlight
 * styling via messageStore.highlightMessageId.
 */
export function highlightMessage(messageId: string) {
  useMessageStore.getState().setHighlightMessage(messageId);
  setTimeout(() => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 30);
}

interface MessageListProps {
  chatId: string;
  chatType?: 'DIRECT' | 'GROUP' | 'CHANNEL' | 'SAVED';
  otherUserId?: string;
  otherUserIsBot?: boolean;
  onOpenComments?: (commentChatId: string) => void;
}

export function MessageList({ chatId, chatType, otherUserId, otherUserIsBot, onOpenComments }: MessageListProps) {
  const { messages, fetchMessages, isLoading } = useMessageStore();
  const user = useAuthStore((s) => s.user);
  const locale = useI18n((s) => s.locale);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpDown, setShowJumpDown] = useState(false);
  const chatMessages = messages[chatId] || [];

  // Show "jump to bottom" pill when user has scrolled up past ~300px.
  // Listens on the scroll container so the button reflects current
  // scroll position even if new messages arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowJumpDown(distance > 300);
    };
    el.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => el.removeEventListener('scroll', handler);
  }, [chatId, chatMessages.length]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages(chatId);
  }, [chatId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Send read receipt for last message from other users
  useEffect(() => {
    if (!chatMessages.length || !user) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg && lastMsg.senderId !== user.id) {
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('message:read', { chatId, messageId: lastMsg.id });
      }
    }
  }, [chatId, chatMessages.length, user]);

  if (isLoading && chatMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!isLoading && chatMessages.length === 0 && chatType === 'DIRECT' && otherUserIsBot) {
    return <BotStartButton chatId={chatId} />;
  }

  return (
    <div className="relative flex-1 min-h-0">
    <div ref={scrollRef} className="absolute inset-0 overflow-y-auto scrollbar-hidden px-4 py-2 space-y-1">
      {chatMessages.map((message, index) => {
        const prevMessage = chatMessages[index - 1];
        const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;
        const isOwn = message.senderId === user?.id;
        const date = new Date(message.createdAt);
        // Show divider before the first message of every new calendar
        // day (and before the very first one in the list).
        const showDivider =
          !prevMessage || !isSameDay(new Date(prevMessage.createdAt), date);

        return (
          <React.Fragment key={message.id}>
            {showDivider && <DateDivider label={dayLabel(date, locale)} />}
            <MessageBubble
              message={message}
              isOwn={isOwn}
              showAvatar={showAvatar}
              chatType={chatType}
              otherUserId={otherUserId}
              onOpenComments={onOpenComments}
            />
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
    {/* Floating "jump to bottom" pill — fades in when the user has
        scrolled up. Click smooth-scrolls to the latest message. */}
    {showJumpDown && (
      <button
        onClick={scrollToBottom}
        className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white/85 dark:bg-dark-700/85 backdrop-blur-md shadow-lg border border-white/40 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-dark-600 transition-all animate-fade-in"
        aria-label="Scroll to bottom"
      >
        <ChevronDown size={18} />
      </button>
    )}
    </div>
  );
}
