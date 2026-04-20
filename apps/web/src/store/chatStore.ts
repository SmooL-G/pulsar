import { create } from 'zustand';
import type { Chat } from '@pulsar/shared';
import { api } from '../services/api';

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  isLoading: boolean;
  savedChatId: string | null;
  setActiveChat: (chat: Chat | null) => void;
  fetchChats: () => Promise<void>;
  openSavedChat: () => Promise<void>;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  removeChat: (chatId: string) => void;
  updateUserPresence: (userId: string, isOnline: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  isLoading: false,
  savedChatId: null,

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
      // Ensure Saved chat exists (lazy-created server-side).
      const [savedRes, chatsRes] = await Promise.all([
        api.get('/chats/saved').catch(() => null),
        api.get('/chats'),
      ]);
      const savedChatId = savedRes?.data?.chat?.id || null;
      const chats: Chat[] = chatsRes.data.chats;
      // If the Saved chat was just created and isn't in the list yet, append a stub.
      if (savedChatId && !chats.find((c) => c.id === savedChatId)) {
        chats.push({
          id: savedChatId,
          type: 'SAVED',
          name: null,
          memberCount: 1,
          updatedAt: new Date().toISOString(),
        } as any);
      }
      set({ chats, savedChatId, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  openSavedChat: async () => {
    const id = get().savedChatId;
    const chat = id ? get().chats.find((c) => c.id === id) : null;
    if (chat) {
      get().setActiveChat(chat);
      return;
    }
    try {
      const { data } = await api.get('/chats/saved');
      const saved: Chat = {
        id: data.chat.id,
        type: 'SAVED',
        name: null,
        memberCount: 1,
        updatedAt: new Date().toISOString(),
      } as any;
      set((state) => ({
        savedChatId: data.chat.id,
        chats: state.chats.find((c) => c.id === data.chat.id) ? state.chats : [saved, ...state.chats],
      }));
      get().setActiveChat(saved);
    } catch { /* noop */ }
  },

  addChat: (chat) => {
    const existing = get().chats.find((c) => c.id === chat.id);
    if (!existing) {
      set((state) => ({ chats: [chat, ...state.chats] }));
    }
  },

  updateChat: (chatId, updates) => {
    set((state) => {
      const updated = state.chats.map((c) => (c.id === chatId ? { ...c, ...updates } : c));
      // Move chat with new message to top
      if ((updates as any).lastMessage) {
        const idx = updated.findIndex((c) => c.id === chatId);
        if (idx > 0) {
          const [chat] = updated.splice(idx, 1);
          updated.unshift(chat);
        }
      }
      return {
        chats: updated,
        activeChat:
          state.activeChat?.id === chatId
            ? { ...state.activeChat, ...updates }
            : state.activeChat,
      };
    });
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
