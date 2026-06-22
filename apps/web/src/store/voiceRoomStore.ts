import { create } from 'zustand';

/**
 * State for the currently-active group voice room (if any). Single
 * room at a time — joining another auto-leaves the current one.
 */

export interface VoiceRoomParticipant {
  userId: string;
  isMuted: boolean;
  canStreamVideo: boolean;
  isStreamingVideo: boolean;
  joinedAt: number;
  /** Loaded lazily — username/displayName/avatar for the tile. */
  profile?: {
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  /** Audio MediaStream from this peer (if their tracks are flowing).
   *  null for the local user. */
  stream?: MediaStream | null;
  /** Updated continuously by the AudioContext analyser. true while
   *  RMS exceeds the speaking threshold. */
  isSpeaking?: boolean;
}

interface VoiceRoomState {
  activeChatId: string | null;
  participants: Map<string, VoiceRoomParticipant>;
  localStream: MediaStream | null;
  myMuted: boolean;
  myVideoOn: boolean;
  /** Outstanding video requests — only populated for admins. */
  videoRequests: Set<string>;
  isMinimized: boolean;

  setActive: (chatId: string) => void;
  reset: () => void;
  setParticipants: (list: VoiceRoomParticipant[]) => void;
  addParticipant: (p: VoiceRoomParticipant) => void;
  removeParticipant: (userId: string) => void;
  updateParticipant: (userId: string, patch: Partial<VoiceRoomParticipant>) => void;
  setLocalStream: (s: MediaStream | null) => void;
  setMyMuted: (m: boolean) => void;
  setMyVideoOn: (v: boolean) => void;
  addVideoRequest: (userId: string) => void;
  removeVideoRequest: (userId: string) => void;
  setMinimized: (m: boolean) => void;
}

export const useVoiceRoomStore = create<VoiceRoomState>((set) => ({
  activeChatId: null,
  participants: new Map(),
  localStream: null,
  myMuted: false,
  myVideoOn: false,
  videoRequests: new Set(),
  isMinimized: false,

  setActive: (chatId) => set({ activeChatId: chatId }),

  reset: () => set({
    activeChatId: null,
    participants: new Map(),
    localStream: null,
    myMuted: false,
    myVideoOn: false,
    videoRequests: new Set(),
    isMinimized: false,
  }),

  setParticipants: (list) => set(() => {
    const m = new Map<string, VoiceRoomParticipant>();
    for (const p of list) m.set(p.userId, p);
    return { participants: m };
  }),

  addParticipant: (p) => set((state) => {
    const m = new Map(state.participants);
    m.set(p.userId, { ...m.get(p.userId), ...p });
    return { participants: m };
  }),

  removeParticipant: (userId) => set((state) => {
    const m = new Map(state.participants);
    m.delete(userId);
    return { participants: m };
  }),

  updateParticipant: (userId, patch) => set((state) => {
    const cur = state.participants.get(userId);
    if (!cur) return {};
    const m = new Map(state.participants);
    m.set(userId, { ...cur, ...patch });
    return { participants: m };
  }),

  setLocalStream: (s) => set({ localStream: s }),
  setMyMuted: (m) => set({ myMuted: m }),
  setMyVideoOn: (v) => set({ myVideoOn: v }),

  addVideoRequest: (userId) => set((state) => {
    const s = new Set(state.videoRequests);
    s.add(userId);
    return { videoRequests: s };
  }),

  removeVideoRequest: (userId) => set((state) => {
    const s = new Set(state.videoRequests);
    s.delete(userId);
    return { videoRequests: s };
  }),

  setMinimized: (m) => set({ isMinimized: m }),
}));
