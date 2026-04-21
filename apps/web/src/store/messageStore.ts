import { create } from 'zustand';
import type { Message, MessageStatus, ReactionGroup } from '@pulsar/shared';
import { api } from '../services/api';

interface MessageState {
  messages: Record<string, Message[]>; // chatId -> messages
  isLoading: boolean;
  hasMore: Record<string, boolean>;
  cursors: Record<string, string | null>;
  highlightMessageId: string | null;
  fetchMessages: (chatId: string) => Promise<void>;
  fetchMoreMessages: (chatId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  hideMessage: (chatId: string, messageId: string) => void;
  setMessageStatus: (chatId: string, messageId: string, status: MessageStatus) => void;
  markChatRead: (chatId: string, readerId: string, senderId: string) => void;
  setHighlightMessage: (messageId: string | null) => void;
  updateReactions: (chatId: string, messageId: string, reactions: ReactionGroup[]) => void;
  updateChecklistChecks: (chatId: string, messageId: string, checks: { itemId: string; userIds: string[] }[]) => void;
  updatePollVotes: (chatId: string, messageId: string, votes: { optionId: string; userIds: string[] }[]) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: {},
  isLoading: false,
  hasMore: {},
  cursors: {},
  highlightMessageId: null,

  setHighlightMessage: (messageId) => {
    set({ highlightMessageId: messageId });
    if (messageId) {
      setTimeout(() => set({ highlightMessageId: null }), 3000);
    }
  },

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

  setMessageStatus: (chatId, messageId, status) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, status } : m
        ),
      },
    }));
  },

  updateReactions: (chatId, messageId, reactions) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      },
    }));
  },

  updateChecklistChecks: (chatId, messageId, checks) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === messageId ? ({ ...m, checklistChecks: checks } as any) : m
        ),
      },
    }));
  },

  updatePollVotes: (chatId, messageId, votes) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === messageId ? ({ ...m, pollVotes: votes } as any) : m
        ),
      },
    }));
  },

  markChatRead: (chatId, readerId, senderId) => {
    // Mark all messages from senderId in this chat as read
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.senderId === senderId && m.status !== 'read'
            ? { ...m, status: 'read' as const }
            : m
        ),
      },
    }));
  },
}));
