import { z } from 'zod';
import { LIMITS } from '../constants/limits.js';

export const registerSchema = z.object({
  username: z
    .string()
    .min(LIMITS.USERNAME_MIN)
    .max(LIMITS.USERNAME_MAX)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscores'),
  email: z.string().email().optional(),
  password: z.string().min(8).max(128).optional(),
  displayName: z.string().max(LIMITS.DISPLAY_NAME_MAX).optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(LIMITS.DISPLAY_NAME_MAX).optional(),
  bio: z.string().max(LIMITS.BIO_MAX).optional(),
  avatarUrl: z.string().url().optional(),
});

export const walletAuthSchema = z.object({
  walletAddress: z.string().min(32).max(44),
  signature: z.string(),
  nonce: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type WalletAuthInput = z.infer<typeof walletAuthSchema>;
