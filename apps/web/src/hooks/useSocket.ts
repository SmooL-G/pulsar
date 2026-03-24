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
    });

    socket.on('connect', () => {
      connectedRef.current = true;
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      connectedRef.current = false;
      console.log('Socket disconnected');
    });

    // Message events
    socket.on('message:new', (message: Message) => {
      addMessage(message);
      updateChat(message.chatId, {
        lastMessage: message,
      } as any);
    });

    socket.on('message:updated', (message: Message) => {
      updateMessage(message);
    });

    socket.on('message:deleted', ({ chatId, messageId }: { chatId: string; messageId: string }) => {
      deleteMessage(chatId, messageId);
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

    // Typing events
    socket.on('typing:update', (_data: { chatId: string; userId: string; username: string; isTyping: boolean }) => {
      // TODO: show typing indicator in UI
    });

    // Presence events
    socket.on('presence:update', (_data: { userId: string; isOnline: boolean }) => {
      // TODO: update online status in UI
    });

    // Heartbeat
    const heartbeatInterval = setInterval(() => {
      if (socket?.connected) {
        socket.emit('presence:heartbeat');
      }
    }, 30000);

    return () => {
      clearInterval(heartbeatInterval);
      if (socket) {
        socket.disconnect();
        socket = null;
        connectedRef.current = false;
      }
    };
  }, [isAuthenticated, addMessage, updateMessage, deleteMessage, markChatRead, updateChat, addChat]);

  return socket;
}
