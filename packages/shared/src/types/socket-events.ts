import type { Message } from './message.js';
import type { Chat } from './chat.js';

// Client → Server events
export interface ClientToServerEvents {
  'message:send': (data: {
    chatId: string;
    content?: string;
    type?: string;
    replyToId?: string;
    attachmentIds?: string[];
    signature?: string;
    signerWallet?: string;
    encryptedContent?: string;
    commentsEnabled?: boolean;
    attachments?: { fileName: string; fileSize: number; mimeType: string; url: string }[];
  }) => void;

  'message:edit': (data: {
    messageId: string;
    content: string;
  }) => void;

  'message:delete': (data: {
    messageId: string;
  }) => void;

  'message:read': (data: {
    chatId: string;
    messageId: string;
  }) => void;

  'typing:start': (data: {
    chatId: string;
  }) => void;

  'typing:stop': (data: {
    chatId: string;
  }) => void;

  'presence:heartbeat': () => void;

  // ─── WebRTC signaling (P2P transport) ─────────────────────
  // Server only relays these between users; never inspects payload.
  'webrtc:offer': (data: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:answer': (data: { to: string; sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:ice': (data: { to: string; candidate: RTCIceCandidateInit }) => void;
  'webrtc:close': (data: { to: string; reason?: string }) => void;

  // ─── Voice/video calls (high-level state, separate from raw SDP) ─
  // The actual media stream is negotiated via webrtc:* above; these
  // events drive the call lifecycle (invite → accept/reject → end).
  'call:invite': (data: { to: string; callId: string; kind: 'audio' | 'video' }) => void;
  'call:accept': (data: { to: string; callId: string }) => void;
  'call:reject': (data: { to: string; callId: string; reason?: 'declined' | 'busy' }) => void;
  'call:cancel': (data: { to: string; callId: string }) => void;
  'call:end':    (data: { to: string; callId: string; duration: number }) => void;

  // ─── Group voice rooms (mesh P2P, up to ~10 participants) ────────
  // Per-chat room. Audio is on by default for joiners; video requires
  // admin grant (chat.OWNER/ADMIN/MODERATOR).
  'voiceRoom:join':         (data: { chatId: string }) => void;
  'voiceRoom:leave':        (data: { chatId: string }) => void;
  'voiceRoom:mute':         (data: { chatId: string; isMuted: boolean }) => void;
  'voiceRoom:videoRequest': (data: { chatId: string }) => void;
  'voiceRoom:videoGrant':   (data: { chatId: string; targetUserId: string; allowed: boolean }) => void;
  'voiceRoom:videoStart':   (data: { chatId: string }) => void;
  'voiceRoom:videoStop':    (data: { chatId: string }) => void;
}

// Server → Client events
export interface ServerToClientEvents {
  'message:new': (data: Message) => void;

  'message:updated': (data: Message) => void;

  'message:deleted': (data: {
    messageId: string;
    chatId: string;
  }) => void;

  'message:read': (data: {
    chatId: string;
    messageId: string;
    userId: string;
  }) => void;

  'typing:update': (data: {
    chatId: string;
    users: { id: string; username: string }[];
  }) => void;

  'presence:update': (data: {
    userId: string;
    isOnline: boolean;
  }) => void;

  'notification:new': (data: {
    id: string;
    type: string;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  }) => void;

  'chat:updated': (data: Chat) => void;

  // Pinned messages list changed in a chat (someone pinned/unpinned).
  // Payload mirrors the GET /messages/chat/:id/pinned response so the
  // banner can replace its state in one set.
  'chat:pinned-updated': (data: { chatId: string; pinned: unknown[] }) => void;

  'wallet:balance-updated': (data: {
    balance: string;
    change: string;
    type: 'DEPOSIT' | 'PURCHASE' | 'REWARD' | 'TRANSFER';
  }) => void;

  'message:reaction': (data: {
    messageId: string;
    chatId: string;
    reactions: { emoji: string; count: number; userIds: string[] }[];
  }) => void;

  'checklist:update': (data: {
    messageId: string;
    chatId: string;
    checks: { itemId: string; userIds: string[] }[];
  }) => void;

  'poll:update': (data: {
    messageId: string;
    chatId: string;
    votes: { optionId: string; userIds: string[] }[];
  }) => void;

  'message:transcribed': (data: {
    chatId: string;
    messageId: string;
    transcription: string;
  }) => void;

  'message:pinned': (data: {
    chatId: string;
    messageId: string;
    pinnedBy: string;
  }) => void;

  'message:unpinned': (data: {
    chatId: string;
    messageId: string;
  }) => void;

  'report:votes-updated': (data: {
    reportId: string;
    counts: Record<string, number>;
    resolved: boolean;
    verdict?: string | null;
  }) => void;

  'error': (data: {
    code: string;
    message: string;
  }) => void;

  // ─── WebRTC signaling (relayed to receiver) ───────────────
  'webrtc:offer': (data: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:answer': (data: { from: string; sdp: RTCSessionDescriptionInit }) => void;
  'webrtc:ice': (data: { from: string; candidate: RTCIceCandidateInit }) => void;
  'webrtc:close': (data: { from: string; reason?: string }) => void;

  // ─── Voice/video call lifecycle (relayed) ─────────────────
  'call:incoming':    (data: { from: string; callId: string; kind: 'audio' | 'video' }) => void;
  'call:ringing':     (data: { callId: string }) => void;
  'call:unavailable': (data: { callId: string; reason: 'offline' | 'busy' }) => void;
  'call:accepted':    (data: { from: string; callId: string }) => void;
  'call:rejected':    (data: { from: string; callId: string; reason?: 'declined' | 'busy' }) => void;
  'call:cancelled':   (data: { from: string; callId: string }) => void;
  'call:ended':       (data: { from: string; callId: string; duration: number }) => void;

  // ─── Group voice rooms (server → clients) ─────────────────
  'voiceRoom:participants': (data: {
    chatId: string;
    participants: { userId: string; isMuted: boolean; canStreamVideo: boolean; isStreamingVideo: boolean; joinedAt: number }[];
  }) => void;
  'voiceRoom:participantJoined': (data: { chatId: string; userId: string }) => void;
  'voiceRoom:participantLeft':   (data: { chatId: string; userId: string }) => void;
  'voiceRoom:participantMuted':  (data: { chatId: string; userId: string; isMuted: boolean }) => void;
  'voiceRoom:videoRequest':      (data: { chatId: string; userId: string }) => void;
  'voiceRoom:videoGranted':      (data: { chatId: string; userId: string; allowed: boolean }) => void;
  'voiceRoom:videoStarted':      (data: { chatId: string; userId: string }) => void;
  'voiceRoom:videoStopped':      (data: { chatId: string; userId: string }) => void;
  'voiceRoom:closed':            (data: { chatId: string }) => void;
  'voiceRoom:error':             (data: { chatId: string; code: 'FULL' | 'FORBIDDEN' | 'VIDEO_LIMIT' | 'NOT_ALLOWED' }) => void;
}
