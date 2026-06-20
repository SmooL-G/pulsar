import { useEffect, useState } from 'react';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { getSocket } from './useSocket';

/**
 * Per-tab badge state for the BottomNav.
 *
 *   chat     — blinking dot if any chat has unreadCount > 0
 *   contacts — plus dot if incoming friend requests > 0
 *   wallet   — plus dot when PLS balance has changed since the user
 *              last opened the Wallet tab
 *   home     — plus dot when any of the other three are firing
 *              (acts as a roll-up indicator for users who pinned only
 *              the Home tab)
 *
 * Wallet "since last visit" is tracked via localStorage timestamps —
 * the BottomNav calls `markVisited('wallet')` on tab click.
 */

const LS_PREFIX = 'pulsar:navBadge:';

export interface NavBadges {
  home: boolean;
  chat: number;       // unread count (0 = no badge)
  contacts: number;   // request count
  wallet: boolean;    // dirty flag
}

export function markVisited(tab: 'chat' | 'contacts' | 'wallet' | 'home') {
  try {
    localStorage.setItem(LS_PREFIX + tab, String(Date.now()));
    window.dispatchEvent(new Event('pulsar:nav-visited'));
  } catch { /* private mode */ }
}

function getLastVisited(tab: string): number {
  try {
    const v = localStorage.getItem(LS_PREFIX + tab);
    return v ? parseInt(v, 10) : 0;
  } catch {
    return 0;
  }
}

export function useNavBadges(): NavBadges {
  const chats = useChatStore((s) => s.chats);
  const userBalance = useAuthStore((s) => (s.user as any)?.plsBalance ?? '0');

  // chat: total unread across all chats
  const chatUnread = chats.reduce((acc, c) => acc + ((c as any).unreadCount || 0), 0);

  // contacts: incoming friend requests — polled + socket-refreshable
  const [requestCount, setRequestCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.get('/friends/requests');
        if (!cancelled) setRequestCount((data.incoming || []).length);
      } catch { /* ignore */ }
    };
    load();
    const id = window.setInterval(load, 60_000); // refresh hourly … err, minute
    // Socket-driven refresh: when someone sends/accepts a request,
    // the server emits friend events on the user's room.
    const socket = getSocket();
    const handler = () => load();
    socket?.on?.('friend:request-received', handler);
    socket?.on?.('friend:request-cancelled', handler);
    socket?.on?.('friend:accepted', handler);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      socket?.off?.('friend:request-received', handler);
      socket?.off?.('friend:request-cancelled', handler);
      socket?.off?.('friend:accepted', handler);
    };
  }, []);

  // wallet: dirty when balance has changed since last visit
  const [walletDirty, setWalletDirty] = useState(false);
  useEffect(() => {
    const recompute = () => {
      const lastVisited = getLastVisited('wallet');
      const lastBalanceStamp = parseInt(localStorage.getItem(LS_PREFIX + 'wallet:lastBalanceStamp') || '0', 10);
      setWalletDirty(lastBalanceStamp > lastVisited);
    };
    recompute();
    const onVisit = () => recompute();
    window.addEventListener('pulsar:nav-visited', onVisit);
    window.addEventListener('storage', recompute);
    return () => {
      window.removeEventListener('pulsar:nav-visited', onVisit);
      window.removeEventListener('storage', recompute);
    };
  }, []);

  // Stamp wallet changes whenever balance changes (socket already
  // updates the user store; we just observe).
  useEffect(() => {
    try {
      localStorage.setItem(LS_PREFIX + 'wallet:lastBalanceStamp', String(Date.now()));
      const lastVisited = getLastVisited('wallet');
      setWalletDirty(Date.now() > lastVisited);
    } catch { /* ignore */ }
  }, [userBalance]);

  const home = chatUnread > 0 || requestCount > 0 || walletDirty;

  return {
    home,
    chat: chatUnread,
    contacts: requestCount,
    wallet: walletDirty,
  };
}
