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
  updateUserPresence: (userId: string, isOnline: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  isLoading: false,

  setActiveChat: (chat) => {
    // Reset unread count when opening a chat
    if (chat) {
      set((state) => ({
        activeChat: chat,
        chats: state.chats.map((c) => c.id === chat.id ? { ...c, unreadCount: 0 } : c),
      }));
    } else {
      set({ activeChat: null });
    }
  },

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

  updateUserPresence: (userId, isOnline) => {
    set((state) => ({
      chats: state.chats.map((c) => {
        const other = (c as any).otherUser;
        if (other?.id === userId) {
          return { ...c, otherUser: { ...other, isOnline } } as any;
        }
        return c;
      }),
      activeChat: (() => {
        const ac = state.activeChat;
        if (!ac) return null;
        const other = (ac as any).otherUser;
        if (other?.id === userId) {
          return { ...ac, otherUser: { ...other, isOnline } } as any;
        }
        return ac;
      })(),
    }));
  },
}));
