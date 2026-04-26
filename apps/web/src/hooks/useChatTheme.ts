import { useEffect, useState } from 'react';

/**
 * Available chat wallpapers (Premium feature). The CSS string is applied
 * directly as `background` on the chat canvas. `none` falls back to the
 * theme default (transparent over the dark/light app bg).
 */
export interface ChatWallpaper {
  id: string;
  name: { en: string; ru: string };
  /** CSS background value. */
  css: string;
  /** Subtle preview thumbnail used in the picker grid. */
  preview: string;
}

export const CHAT_WALLPAPERS: ChatWallpaper[] = [
  {
    id: 'default',
    name: { en: 'Default', ru: 'По умолчанию' },
    css: '',
    preview: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
  },
  {
    id: 'sunset',
    name: { en: 'Sunset', ru: 'Закат' },
    css: 'linear-gradient(135deg, #fb923c 0%, #ec4899 50%, #8b5cf6 100%)',
    preview: 'linear-gradient(135deg, #fb923c 0%, #ec4899 50%, #8b5cf6 100%)',
  },
  {
    id: 'ocean',
    name: { en: 'Ocean', ru: 'Океан' },
    css: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 50%, #14b8a6 100%)',
    preview: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 50%, #14b8a6 100%)',
  },
  {
    id: 'forest',
    name: { en: 'Forest', ru: 'Лес' },
    css: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
    preview: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
  },
  {
    id: 'lavender',
    name: { en: 'Lavender', ru: 'Лаванда' },
    css: 'linear-gradient(135deg, #c084fc 0%, #a78bfa 50%, #818cf8 100%)',
    preview: 'linear-gradient(135deg, #c084fc 0%, #a78bfa 50%, #818cf8 100%)',
  },
  {
    id: 'midnight',
    name: { en: 'Midnight', ru: 'Полночь' },
    css: 'radial-gradient(ellipse at top, #1e1b4b 0%, #020617 80%)',
    preview: 'radial-gradient(ellipse at top, #1e1b4b 0%, #020617 80%)',
  },
];

const STORAGE_KEY = 'pulsar_chat_wallpaper';

export function getStoredWallpaperId(): string {
  return localStorage.getItem(STORAGE_KEY) || 'default';
}

export function setStoredWallpaperId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
  // Notify any active useChatTheme() consumers in this tab.
  window.dispatchEvent(new CustomEvent('pulsar:wallpaper-change'));
}

/** React hook — returns the current wallpaper and re-renders on change. */
export function useChatTheme(): ChatWallpaper {
  const [id, setId] = useState<string>(() => getStoredWallpaperId());

  useEffect(() => {
    const onChange = () => setId(getStoredWallpaperId());
    window.addEventListener('pulsar:wallpaper-change', onChange);
    window.addEventListener('storage', onChange); // cross-tab sync
    return () => {
      window.removeEventListener('pulsar:wallpaper-change', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return CHAT_WALLPAPERS.find((w) => w.id === id) || CHAT_WALLPAPERS[0];
}
