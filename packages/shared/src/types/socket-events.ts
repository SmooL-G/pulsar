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

  'wallet:balance-updated': (data: {
    balance: string;
    change: string;
    type: 'DEPOSIT' | 'PURCHASE' | 'REWARD';
  }) => void;

  'error': (data: {
    code: string;
    message: string;
  }) => void;
}
