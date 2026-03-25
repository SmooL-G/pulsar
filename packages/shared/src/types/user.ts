export enum UserRole {
  USER = 'USER',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
  DELETED = 'DELETED',
}

export enum WalletType {
  EXTERNAL = 'EXTERNAL',
  CUSTODIAL = 'CUSTODIAL',
}

export interface User {
  id: string;
  walletAddress: string;
  walletType: WalletType;
  email: string | null;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  verificationLevel: number;
  role: UserRole;
  status: UserStatus;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface UserProfile extends User {
  nftAvatarMint: string | null;
}
