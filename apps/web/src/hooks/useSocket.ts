import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useMessageStore } from '../store/messageStore';
import { useChatStore } from '../store/chatStore';
import type { Message } from '@pulsar/shared';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function useSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addMessage = useMessageStore((s) => s.addMessage);
  const updateMessage = useMessageStore((s) => s.updateMessage);
  const deleteMessage = useMessageStore((s) => s.deleteMessage);
  const markChatRead = useMessageStore((s) => s.markChatRead);
  const updateChat = useChatStore((s) => s.updateChat);
  const addChat = useChatStore((s) => s.addChat);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        socket = null;
        connectedRef.current = false;
      }
      return;
    }

    if (connectedRef.current) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      reconnectionAttempts: Infinity,
      timeout: 8000,
    });

    socket.on('connect', () => {
      connectedRef.current = true;
      // Refetch active chat messages — we may have missed pushes while disconnected
      const activeChatId = useChatStore.getState().activeChat?.id;
      if (activeChatId) {
        useMessageStore.getState().fetchMessages(activeChatId).catch(() => {});
      }
    });

    socket.on('disconnect', () => {
      connectedRef.current = false;
    });

    // iOS Safari pauses WebSockets when the page is hidden — force reconnect on resume
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !socket) return;
      if (!socket.connected) {
        socket.connect();
      } else {
        // Refetch in case socket stayed alive but missed events during sleep
        const activeChatId = useChatStore.getState().activeChat?.id;
        if (activeChatId) {
          useMessageStore.getState().fetchMessages(activeChatId).catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);
    window.addEventListener('online', onVisibilityChange);

    // Message events
    socket.on('message:new', (message: Message) => {
      // Remove optimistic pending message if this is our own confirmed message
      const currentUserId = useAuthStore.getState().user?.id;
      const isOwnMessage = message.senderId === currentUserId;
      if (isOwnMessage) {
        const chatMsgs = useMessageStore.getState().messages[message.chatId] || [];
        const pending = chatMsgs.find((m) => m.id.startsWith('pending-') && m.senderId === currentUserId);
        if (pending) {
          useMessageStore.getState().deleteMessage(message.chatId, pending.id);
        }
      }
      addMessage(message);
      const activeChatId = useChatStore.getState().activeChat?.id;
      const isActiveChat = activeChatId === message.chatId;
      const chat = useChatStore.getState().chats.find((c) => c.id === message.chatId);
      const newUnread = (!isOwnMessage && !isActiveChat)
        ? ((chat?.unreadCount || 0) + 1)
        : (isActiveChat ? 0 : (chat?.unreadCount || 0));
      updateChat(message.chatId, {
        lastMessage: message,
        unreadCount: newUnread,
      } as any);
    });

    socket.on('message:updated', (message: Message) => {
      updateMessage(message);
    });

    socket.on('message:deleted', ({ chatId, messageId }: { chatId: string; messageId: string }) => {
      deleteMessage(chatId, messageId);
    });

    socket.on('message:reaction', ({ chatId, messageId, reactions }: { chatId: string; messageId: string; reactions: { emoji: string; count: number; userIds: string[] }[] }) => {
      useMessageStore.getState().updateReactions(chatId, messageId, reactions as any);
    });

    socket.on('checklist:update', ({ chatId, messageId, checks }: { chatId: string; messageId: string; checks: { itemId: string; userIds: string[] }[] }) => {
      useMessageStore.getState().updateChecklistChecks(chatId, messageId, checks);
    });

    socket.on('poll:update', ({ chatId, messageId, votes }: { chatId: string; messageId: string; votes: { optionId: string; userIds: string[] }[] }) => {
      useMessageStore.getState().updatePollVotes(chatId, messageId, votes);
    });

    socket.on('message:read', ({ chatId, userId: readerId }: { chatId: string; messageId: string; userId: string }) => {
      // The reader read our messages — mark all our messages in that chat as read
      const currentUserId = useAuthStore.getState().user?.id;
      if (currentUserId && readerId !== currentUserId) {
        markChatRead(chatId, readerId, currentUserId);
      }
    });

    // Chat events
    socket.on('chat:new', (chat: any) => {
      addChat(chat);
    });

    // Wallet events
    socket.on('wallet:balance-updated', (data: { balance: string; change: string; type: string }) => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setUser({ ...currentUser, plsBalance: data.balance } as any);
      }
    });

    // Typing events
    socket.on('typing:update', (_data: { chatId: string; userId: string; username: string; isTyping: boolean }) => {
      // TODO: show typing indicator in UI
    });

    // Presence events
    socket.on('presence:update', (data: { userId: string; isOnline: boolean }) => {
      const { useChatStore } = require('../store/chatStore');
      useChatStore.getState().updateUserPresence(data.userId, data.isOnline);
    });

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      if (socket?.connected) {
        socket.emit('presence:heartbeat');
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
      window.removeEventListener('online', onVisibilityChange);
      if (socket) {
        socket.disconnect();
        socket = null;
        connectedRef.current = false;
      }
    };
  }, [isAuthenticated, addMessage, updateMessage, deleteMessage, markChatRead, updateChat, addChat]);

  return socket;
}
