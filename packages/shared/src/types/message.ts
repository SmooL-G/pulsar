export enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM',
  VOICE = 'VOICE',
  VIDEO = 'VIDEO',
  CHECKLIST = 'CHECKLIST',
  POLL = 'POLL',
  SUPERCHAT = 'SUPERCHAT',
}

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string | null;
  type: MessageType;
  replyToId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  metadata: Record<string, unknown> | null;
  signature?: string | null;
  signerWallet?: string | null;
  encryptedContent?: string | null;
  encryptionType?: string | null;
  commentsEnabled?: boolean;
  commentChatId?: string | null;
  commentCount?: number;
  // SuperChat (paid highlighted message in groups/channels). Stored as
  // BigInt server-side, serialized as string over the wire.
  superchatAmount?: string | null;
  superchatTier?: 'blue' | 'green' | 'yellow' | 'red' | null;
  pinnedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
  status?: MessageStatus;
  sender?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  attachments?: FileAttachment[];
  replyTo?: Message | null;
  reactions?: ReactionGroup[];
}

export interface FileAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url?: string;
  thumbnailUrl?: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
}

/** Static structure of a checklist message, stored in message.metadata.checklist. */
export interface ChecklistMeta {
  title?: string;
  items: { id: string; text: string }[];
}

/** Per-item check state, computed server-side from the checklist_checks table. */
export interface ChecklistCheckState {
  itemId: string;
  userIds: string[];
}

/** Static structure of a poll message, stored in message.metadata.poll. */
export interface PollMeta {
  question: string;
  options: { id: string; text: string }[];
  allowMultiple?: boolean;
  anonymous?: boolean;
}

/** Per-option vote state, computed server-side from the poll_votes table. */
export interface PollVoteState {
  optionId: string;
  userIds: string[];
}
