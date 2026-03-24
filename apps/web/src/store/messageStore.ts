import { create } from 'zustand';
import type { Message } from '@pulsar/shared';
import { api } from '../services/api';

interface MessageState {
  messages: Record<string, Message[]>; // chatId -> messages
  isLoading: boolean;
  hasMore: Record<string, boolean>;
  cursors: Record<string, string | null>;
  fetchMessages: (chatId: string) => Promise<void>;
  fetchMoreMessages: (chatId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  hideMessage: (chatId: string, messageId: string) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: {},
  isLoading: false,
  hasMore: {},
  cursors: {},

  fetchMessages: async (chatId: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/messages/chat/${chatId}`);
      set((state) => ({
        messages: { ...state.messages, [chatId]: data.messages.reverse() },
        cursors: { ...state.cursors, [chatId]: data.nextCursor },
        hasMore: { ...state.hasMore, [chatId]: !!data.nextCursor },
        isLoading: false,
      }));
    } catch {
      set({ isLoading: false });
    }
  },

  fetchMoreMessages: async (chatId: string) => {
    const cursor = get().cursors[chatId];
    if (!cursor) return;

    try {
      const { data } = await api.get(`/messages/chat/${chatId}`, {
        params: { cursor },
      });
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: [...data.messages.reverse(), ...(state.messages[chatId] || [])],
        },
        cursors: { ...state.cursors, [chatId]: data.nextCursor },
        hasMore: { ...state.hasMore, [chatId]: !!data.nextCursor },
      }));
    } catch {
      // Silently fail
    }
  },

  addMessage: (message: Message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [message.chatId]: [...(state.messages[message.chatId] || []), message],
      },
    }));
  },

  updateMessage: (message: Message) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [message.chatId]: (state.messages[message.chatId] || []).map((m) =>
          m.id === message.id ? message : m
        ),
      },
    }));
  },

  deleteMessage: (chatId: string, messageId: string) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, content: null } : m
        ),
      },
    }));
  },

  hideMessage: (chatId: string, messageId: string) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).filter((m) => m.id !== messageId),
      },
    }));
  },
}));
