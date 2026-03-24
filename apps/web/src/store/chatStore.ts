import { create } from 'zustand';
import type { Chat } from '@pulsar/shared';
import { api } from '../services/api';

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  isLoading: boolean;
  setActiveChat: (chat: Chat | null) => void;
  fetchChats: () => Promise<void>;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  removeChat: (chatId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  isLoading: false,

  setActiveChat: (chat) => set({ activeChat: chat }),

  fetchChats: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/chats');
      set({ chats: data.chats, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addChat: (chat) => {
    const existing = get().chats.find((c) => c.id === chat.id);
    if (!existing) {
      set((state) => ({ chats: [chat, ...state.chats] }));
    }
  },

  updateChat: (chatId, updates) => {
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, ...updates } : c)),
      activeChat:
        state.activeChat?.id === chatId
          ? { ...state.activeChat, ...updates }
          : state.activeChat,
    }));
  },

  removeChat: (chatId) => {
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== chatId),
      activeChat: state.activeChat?.id === chatId ? null : state.activeChat,
    }));
  },
}));
