import React, { useEffect, useRef } from 'react';
import { useMessageStore } from '../../store/messageStore';
import { MessageBubble } from './MessageBubble';
import { BotStartButton } from './BotStartButton';
import { DateDivider } from './DateDivider';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../hooks/useSocket';
import { useI18n } from '../../i18n';
import { isSameDay, dayLabel } from '../../utils/messageDateLabel';

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
  const chatMessages = messages[chatId] || [];

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
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
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
  );
}
