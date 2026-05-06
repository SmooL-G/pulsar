export const LIMITS = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 32,
  DISPLAY_NAME_MAX: 64,
  BIO_MAX: 256,
  MESSAGE_MAX: 4096,
  GROUP_NAME_MAX: 128,
  GROUP_DESCRIPTION_MAX: 512,
  GROUP_MAX_MEMBERS: 500,
  FILE_MAX_SIZE: 50 * 1024 * 1024, // 50 MB (legacy default — prefer maxFileSizeFor() below)
  INVITE_CODE_LENGTH: 8,
  MESSAGES_PER_PAGE: 50,
  CHATS_PER_PAGE: 30,
} as const;

/**
 * Per-tier file upload cap in bytes. MUST stay in sync with the
 * server's apps/server/src/modules/upload/upload.routes.ts
 * getFileSizeLimit().
 */
export function maxFileSizeFor(opts: {
  verificationLevel?: number;
  isPremium?: boolean;
  role?: string;
}): number {
  const { verificationLevel = 0, isPremium = false, role = 'USER' } = opts;
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 100 * 1024 * 1024;
  if (isPremium || verificationLevel >= 3) return 100 * 1024 * 1024;
  if (verificationLevel >= 1) return 50 * 1024 * 1024;
  return 20 * 1024 * 1024;
}
