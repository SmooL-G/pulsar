import { create } from 'zustand';

export type PeerState = 'idle' | 'connecting' | 'open' | 'closed' | 'failed';

interface PeerEntry {
  state: PeerState;
  // Last error message if state === 'failed'
  error?: string;
  // True iff the local user explicitly enabled P2P for this peer.
  // We tear down the channel if this goes false.
  enabled: boolean;
}

interface PeerStore {
  peers: Record<string, PeerEntry>;
  setState: (userId: string, state: PeerState, error?: string) => void;
  setEnabled: (userId: string, enabled: boolean) => void;
  remove: (userId: string) => void;
}

export const usePeerStore = create<PeerStore>((set) => ({
  peers: {},
  setState: (userId, state, error) =>
    set((s) => ({
      peers: {
        ...s.peers,
        [userId]: {
          ...(s.peers[userId] ?? { enabled: false }),
          state,
          error,
        },
      },
    })),
  setEnabled: (userId, enabled) =>
    set((s) => ({
      peers: {
        ...s.peers,
        [userId]: {
          ...(s.peers[userId] ?? { state: 'idle' as PeerState }),
          enabled,
        },
      },
    })),
  remove: (userId) =>
    set((s) => {
      const next = { ...s.peers };
      delete next[userId];
      return { peers: next };
    }),
}));
