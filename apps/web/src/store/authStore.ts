import { create } from 'zustand';
import type { User } from '@pulsar/shared';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  login: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  login: async (accessToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    set({ isAuthenticated: true });

    // Fetch user profile
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data });
    } catch {
      // Will be handled by interceptor
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors during logout
    }
    localStorage.removeItem('accessToken');
    set({ user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
      localStorage.removeItem('accessToken');
    }
  },
}));
