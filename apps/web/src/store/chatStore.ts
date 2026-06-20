import { create } from 'zustand';
import type { Chat } from '@pulsar/shared';
import { api } from '../services/api';

export interface PinnedMsg {
  id: string;
  chatId: string;
  pinnedAt: string;
  message: {
    id: string;
    content: string | null;
    type: string;
    senderId: string;
    sender?: {
      id: string;
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
    };
  };
}

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  isLoading: boolean;
  savedChatId: string | null;
  /** Pinned messages keyed by chat id. Populated by socket
   *  "chat:pinned-updated" + initial GET /messages/chat/:id/pinned. */
  pinnedMessages: Record<string, PinnedMsg[]>;
  /** Snapshot of unread count taken AT THE MOMENT setActiveChat()
   *  is called, before it gets zeroed. MessageList uses this to draw
   *  a "Новые сообщения" divider above the last N messages. Cleared
   *  on chat switch. */
  lastOpenedUnread: { chatId: string; count: number } | null;
  setActiveChat: (chat: Chat | null) => void;
  fetchChats: () => Promise<void>;
  openSavedChat: () => Promise<void>;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  removeChat: (chatId: string) => void;
  updateUserPresence: (userId: string, isOnline: boolean) => void;
  setPinnedMessages: (chatId: string, pinned: PinnedMsg[]) => void;
  removePinnedMessage: (chatId: string, messageId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  isLoading: false,
  savedChatId: null,
  pinnedMessages: {},
  lastOpenedUnread: null,

  setPinnedMessages: (chatId, pinned) => {
    set((state) => ({ pinnedMessages: { ...state.pinnedMessages, [chatId]: pinned } }));
  },

  removePinnedMessage: (chatId, messageId) => {
    set((state) => ({
      pinnedMessages: {
        ...state.pinnedMessages,
        [chatId]: (state.pinnedMessages[chatId] || []).filter(
          (p) => p.message.id !== messageId,
        ),
      },
    }));
  },

  setActiveChat: (chat) => {
    // Reset unread count when opening a chat, but FIRST snapshot it
    // so MessageList can draw a "Новые сообщения" divider above the
    // last N messages.
    if (chat) {
      set((state) => {
        const existing = state.chats.find((c) => c.id === chat.id);
        const prevUnread = (existing as any)?.unreadCount || 0;
        return {
          activeChat: chat,
          lastOpenedUnread: { chatId: chat.id, count: prevUnread },
          chats: state.chats.map((c) => c.id === chat.id ? { ...c, unreadCount: 0 } : c),
        };
      });
    } else {
      set({ activeChat: null, lastOpenedUnread: null });
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
