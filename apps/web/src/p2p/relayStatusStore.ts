import { create } from 'zustand';
import { labelForRelay } from './relays';

/**
 * Tracks which signaling-relay the local browser currently uses.
 * Updated by RelayClient on connect/disconnect; subscribed by the
 * P2PIndicator so users can see "via SAGG" in the tooltip when they
 * open P2P with another user.
 */
interface RelayStatus {
  url: string | null;
  label: string;
  setActive: (url: string | null) => void;
}

export const useRelayStatusStore = create<RelayStatus>((set) => ({
  url: null,
  label: '—',
  setActive: (url) =>
    set({
      url,
      label: url ? labelForRelay(url) : '—',
    }),
}));
