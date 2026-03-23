import { create } from 'zustand';

interface NotificationState {
  enabled: boolean;
  soundEnabled: boolean;
  toggle: () => void;
  toggleSound: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  enabled: localStorage.getItem('notifications') !== 'false',
  soundEnabled: localStorage.getItem('notificationSound') !== 'false',

  toggle: () => {
    const newVal = !get().enabled;
    localStorage.setItem('notifications', String(newVal));
    set({ enabled: newVal });
  },

  toggleSound: () => {
    const newVal = !get().soundEnabled;
    localStorage.setItem('notificationSound', String(newVal));
    set({ soundEnabled: newVal });
  },
}));
