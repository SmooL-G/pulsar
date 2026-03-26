export enum ChatType {
  DIRECT = 'DIRECT',
  GROUP = 'GROUP',
  CHANNEL = 'CHANNEL',
}

export enum MemberRole {
  MEMBER = 'MEMBER',
  AUTHOR = 'AUTHOR',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  inviteCode: string | null;
  ownerId: string | null;
  maxMembers: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    content: string | null;
    type: string;
    createdAt: string;
    sender: {
      username: string;
      displayName: string | null;
    };
  } | null;
  unreadCount?: number;
  members?: ChatMember[];
}

export interface ChatMember {
  id: string;
  chatId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    isOnline: boolean;
  };
}
