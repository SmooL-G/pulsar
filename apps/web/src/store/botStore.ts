import { create } from 'zustand';
import { api } from '../services/api';

export interface BotCommand {
  command: string;
  description: string;
}

export interface Bot {
  id: string;
  userId: string;
  ownerId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  webhookUrl: string | null;
  commands: BotCommand[];
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

interface BotState {
  bots: Bot[];
  isLoading: boolean;
  fetchBots: () => Promise<void>;
  createBot: (name: string) => Promise<{ bot: Bot; token: string }>;
  updateBot: (botId: string, data: { name?: string; webhookUrl?: string; commands?: BotCommand[] }) => Promise<void>;
  regenerateToken: (botId: string) => Promise<string>;
  deleteBot: (botId: string) => Promise<void>;
}

export const useBotStore = create<BotState>((set, get) => ({
  bots: [],
  isLoading: false,

  fetchBots: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/bots');
      set({ bots: data.bots || [] });
    } finally {
      set({ isLoading: false });
    }
  },

  createBot: async (name) => {
    const { data } = await api.post('/bots', { name });
    set((s) => ({ bots: [data.bot, ...s.bots] }));
    return { bot: data.bot, token: data.token };
  },

  updateBot: async (botId, updates) => {
    await api.patch(`/bots/${botId}`, updates);
    set((s) => ({
      bots: s.bots.map((b) =>
        b.id === botId
          ? {
              ...b,
              displayName: updates.name ?? b.displayName,
              webhookUrl: updates.webhookUrl !== undefined ? updates.webhookUrl || null : b.webhookUrl,
              commands: updates.commands ?? b.commands,
            }
          : b
      ),
    }));
  },

  regenerateToken: async (botId) => {
    const { data } = await api.post(`/bots/${botId}/token/regenerate`);
    return data.token as string;
  },

  deleteBot: async (botId) => {
    await api.delete(`/bots/${botId}`);
    set((s) => ({ bots: s.bots.filter((b) => b.id !== botId) }));
  },
}));
