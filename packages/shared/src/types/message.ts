export enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  IMAGE = 'IMAGE',
  SYSTEM = 'SYSTEM',
  VOICE = 'VOICE',
  VIDEO = 'VIDEO',
  CHECKLIST = 'CHECKLIST',
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
