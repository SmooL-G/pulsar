import { z } from 'zod';
import { LIMITS } from '../constants/limits.js';

export const sendMessageSchema = z.object({
  chatId: z.string().uuid(),
  content: z.string().max(LIMITS.MESSAGE_MAX).optional(),
  type: z.enum(['TEXT', 'FILE', 'IMAGE', 'SYSTEM']).default('TEXT'),
  replyToId: z.string().uuid().optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(LIMITS.MESSAGE_MAX),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
