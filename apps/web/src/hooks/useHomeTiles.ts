import { useEffect, useState } from 'react';

/**
 * Per-user "which HomeTab tiles to show" preferences. Stored in
 * localStorage as a JSON array of HIDDEN tile keys (default = all
 * visible). Tile components call useHomeTileVisible(key) to gate
 * their own render, so adding/removing tiles only touches one place.
 */

export type HomeTileKey =
  | 'profile'
  | 'wallet'
  | 'plsPrice'
  | 'burns'
  | 'activity'
  | 'quickActions'
  | 'p2p'
  | 'gpt'
  | 'marketplace';

export const HOME_TILES: { key: HomeTileKey; label: string }[] = [
  { key: 'profile',      label: 'Профиль / Profile' },
  { key: 'wallet',       label: 'Кошелёк / Wallet' },
  { key: 'plsPrice',     label: 'Цена PLS / PLS price' },
  { key: 'burns',        label: 'Сожжено токенов / Burns' },
  { key: 'activity',     label: 'Активность сети / Activity' },
  { key: 'quickActions', label: 'Быстрые действия / Quick actions' },
  { key: 'p2p',          label: 'P2P-биржа' },
  { key: 'gpt',          label: 'Pulsar GPT бот' },
  { key: 'marketplace',  label: 'Маркетплейс' },
];

const STORAGE_KEY = 'pulsar:hiddenHomeTiles';

function readHidden(): Set<HomeTileKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as HomeTileKey[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeHidden(set: Set<HomeTileKey>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    // Notify other hook consumers in this tab.
    window.dispatchEvent(new Event('pulsar:home-tiles-changed'));
  } catch { /* private mode etc. */ }
}

export function useHomeTileVisible(key: HomeTileKey): boolean {
  const [hidden, setHidden] = useState<Set<HomeTileKey>>(readHidden);
  useEffect(() => {
    const handler = () => setHidden(readHidden());
    window.addEventListener('pulsar:home-tiles-changed', handler);
    window.addEventListener('storage', handler);  // cross-tab sync
    return () => {
      window.removeEventListener('pulsar:home-tiles-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return !hidden.has(key);
}

/** Settings panel hook — get + toggle visibility, with reactive state. */
export function useHomeTilesConfig() {
  const [hidden, setHidden] = useState<Set<HomeTileKey>>(readHidden);
  useEffect(() => {
    const handler = () => setHidden(readHidden());
    window.addEventListener('pulsar:home-tiles-changed', handler);
    return () => window.removeEventListener('pulsar:home-tiles-changed', handler);
  }, []);

  const toggle = (key: HomeTileKey) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden(next);
    writeHidden(next);
  };

  const isVisible = (key: HomeTileKey) => !hidden.has(key);
  return { isVisible, toggle, hidden };
}
