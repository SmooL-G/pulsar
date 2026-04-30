import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { getIO } from '../../socket/index.js';
import {
  sendSuperchat,
  SuperchatError,
  MIN_SUPERCHAT,
  MAX_SUPERCHAT,
  SUPERCHAT_TIERS,
} from './superchat.service.js';

export async function superchatRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.get('/config', async () => ({
    min: MIN_SUPERCHAT.toString(),
    max: MAX_SUPERCHAT.toString(),
    ownerShareBps: 7000,
    tiers: SUPERCHAT_TIERS.map((t) => ({
      min: t.min.toString(),
      max: 'max' in t ? (t as any).max.toString() : null,
      color: t.color,
      pinMinutes: t.pinMinutes,
    })),
  }));

  app.post<{ Body: { chatId: string; content: string; amount: string } }>(
    '/send',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { chatId, content, amount } = request.body ?? ({} as any);
      if (typeof chatId !== 'string' || typeof content !== 'string' || typeof amount !== 'string') {
        return reply.status(400).send({ error: 'BAD_INPUT' });
      }
      let amt: bigint;
      try {
        amt = BigInt(amount);
      } catch {
        return reply.status(400).send({ error: 'BAD_AMOUNT' });
      }

      try {
        const result = await sendSuperchat({ senderId: userId, chatId, content, amount: amt });

        // Broadcast the new message to everyone in the chat room.
        try {
          const io = getIO();
          const m = result.message;
          io.to(`chat:${chatId}`).emit('message:new', {
            id: m.id,
            chatId: m.chatId,
            senderId: m.senderId,
            content: m.content,
            type: m.type,
            metadata: null,
            superchatAmount: m.superchatAmount?.toString() ?? null,
            superchatTier: m.superchatTier,
            pinnedUntil: m.pinnedUntil?.toISOString() ?? null,
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt.toISOString(),
            sender: m.sender,
            attachments: [],
            status: 'sent',
          } as any);

          // Refresh balances for sender + owner.
          io.to(`user:${userId}`).emit('wallet:balance-updated', {
            balance: result.senderBalance.toString(),
            change: `-${amt.toString()}`,
            type: 'TRANSFER' as const,
          });
          io.to(`user:${result.ownerId}`).emit('wallet:balance-updated', {
            balance: result.ownerBalance.toString(),
            change: `+${result.ownerShare.toString()}`,
            type: 'REWARD' as const,
          });
        } catch { /* socket failure shouldn't fail the request */ }

        return {
          messageId: result.message.id,
          tier: result.tier,
          ownerShare: result.ownerShare.toString(),
          burned: result.burned.toString(),
          balance: result.senderBalance.toString(),
        };
      } catch (err) {
        if (err instanceof SuperchatError) {
          const status =
            err.code === 'NOT_FOUND' ? 404 :
            err.code === 'NOT_MEMBER' || err.code === 'WRONG_CHAT_TYPE' ? 403 : 400;
          return reply.status(status).send({ error: err.code, message: err.message });
        }
        throw err;
      }
    },
  );
}
