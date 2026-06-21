import { create } from 'zustand';

/**
 * Single global call state. We allow at most one active call at a time
 * (no call-waiting in v1). The UI subscribes to this; the controller in
 * src/p2p/callController.ts mutates it from socket events + user actions.
 */

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'active' | 'ended';
export type CallKind = 'audio' | 'video';

export interface CallPeer {
  userId: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

interface CallState {
  phase: CallPhase;
  callId: string | null;
  kind: CallKind;
  peer: CallPeer | null;
  /** Local mic mute flag — set via toggleMute, read by ActiveCall UI. */
  isMuted: boolean;
  /** Local camera mute flag (video calls only). */
  isVideoMuted: boolean;
  /** Wall-clock ms when call became active (for duration counter). */
  startedAt: number | null;
  /** Last attached remote MediaStream — UI binds it to <audio>/<video>. */
  remoteStream: MediaStream | null;
  /** Local MediaStream for the user's own video preview (video calls). */
  localStream: MediaStream | null;
  /** Why the call ended (for the 1.5s "Ended" splash before reset). */
  endReason: 'hangup' | 'rejected' | 'cancelled' | 'unavailable' | 'missed' | null;
  /** Currently active input (mic) device deviceId, or '' for default. */
  inputDeviceId: string;
  /** Currently active output (speaker/headset) deviceId, or '' for default. */
  outputDeviceId: string;
  /** Minimized state — overlay collapses to a floating pill so the
   *  user can use the rest of the app (chat, wallet, etc.) without
   *  hanging up. Tap the pill → restored to full overlay. */
  isMinimized: boolean;

  setPhase: (phase: CallPhase) => void;
  setCall: (data: { callId: string; kind: CallKind; peer: CallPeer; phase: CallPhase }) => void;
  setRemoteStream: (s: MediaStream | null) => void;
  setLocalStream: (s: MediaStream | null) => void;
  setMuted: (muted: boolean) => void;
  setVideoMuted: (muted: boolean) => void;
  setInputDeviceId: (id: string) => void;
  setOutputDeviceId: (id: string) => void;
  setMinimized: (m: boolean) => void;
  markActive: () => void;
  endCall: (reason: CallState['endReason']) => void;
  reset: () => void;
}

const initial = {
  phase: 'idle' as CallPhase,
  callId: null,
  kind: 'audio' as CallKind,
  peer: null,
  isMuted: false,
  isVideoMuted: false,
  startedAt: null,
  remoteStream: null,
  localStream: null,
  endReason: null,
  inputDeviceId: '',
  outputDeviceId: '',
  isMinimized: false,
};

export const useCallStore = create<CallState>((set) => ({
  ...initial,

  setPhase: (phase) => set({ phase }),

  setCall: ({ callId, kind, peer, phase }) => set({
    callId, kind, peer, phase,
    isMuted: false,
    isVideoMuted: false,
    startedAt: null,
    remoteStream: null,
    localStream: null,
    endReason: null,
    isMinimized: false,
  }),

  setRemoteStream: (s) => set({ remoteStream: s }),
  setLocalStream: (s) => set({ localStream: s }),
  setMuted: (muted) => set({ isMuted: muted }),
  setVideoMuted: (muted) => set({ isVideoMuted: muted }),
  setInputDeviceId: (id) => set({ inputDeviceId: id }),
  setOutputDeviceId: (id) => set({ outputDeviceId: id }),
  setMinimized: (m) => set({ isMinimized: m }),

  markActive: () => set({ phase: 'active', startedAt: Date.now() }),

  endCall: (reason) => set({ phase: 'ended', endReason: reason }),

  reset: () => set({ ...initial }),
}));
