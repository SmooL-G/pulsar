import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { getIO } from '../../socket/index.js';

const FRAME_PRICE = 5_000n;
const BG_PRICE = 3_000n;
const BUBBLE_PRICE = 2_000n;

// Whitelist of preset IDs the client may pick. Keeping this server-side
// stops a tampered client from saving an arbitrary string and breaking
// the avatar wrapper / profile renderer.
const FRAMES = new Set(['gold', 'neon', 'rainbow', 'fire', 'void', 'aurora']);
const BACKGROUNDS = new Set(['aurora', 'sunset', 'ocean', 'midnight', 'rose', 'forest']);
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

async function chargeAndUpdate(
  userId: string,
  cost: bigint,
  alreadyOwns: boolean,
  data: any,
  description: string,
) {
  if (alreadyOwns) {
    // Already paid for this slot before — switching presets is free.
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, avatarFrame: true, bubbleColor: true, profileBg: true },
    });
    return { user: updated, charged: false };
  }
  const wallet = await prisma.plsWallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balance < cost) {
    return { error: 'INSUFFICIENT_FUNDS', message: `Need ${cost} PLS` };
  }
  const [updatedWallet, , user] = await prisma.$transaction([
    prisma.plsWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: cost } },
    }),
    prisma.plsTransaction.create({
      data: { walletId: wallet.id, amount: -cost, type: 'PURCHASE', description },
    }),
    prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, avatarFrame: true, bubbleColor: true, profileBg: true },
    }),
  ]);
  // Push fresh balance.
  try {
    getIO().to(`user:${userId}`).emit('wallet:balance-updated', {
      balance: updatedWallet.balance.toString(),
      change: `-${cost.toString()}`,
      type: 'PURCHASE' as const,
    });
  } catch { /* ignore */ }
  return { user, charged: true, balance: updatedWallet.balance.toString() };
}

export async function customizationRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.get('/config', async () => ({
    frames: [...FRAMES],
    backgrounds: [...BACKGROUNDS],
    prices: {
      avatarFrame: FRAME_PRICE.toString(),
      profileBg: BG_PRICE.toString(),
      bubbleColor: BUBBLE_PRICE.toString(),
    },
  }));

  app.post<{ Body: { frame: string | null } }>('/avatar-frame', async (request, reply) => {
    const userId = request.user!.userId;
    const frame = request.body?.frame;
    if (frame !== null && (typeof frame !== 'string' || !FRAMES.has(frame))) {
      return reply.status(400).send({ error: 'BAD_FRAME' });
    }
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { avatarFrame: true } });
    const result = await chargeAndUpdate(
      userId,
      FRAME_PRICE,
      !!u?.avatarFrame,
      { avatarFrame: frame },
      `Avatar frame: ${frame ?? 'cleared'}`,
    );
    if ((result as any).error) return reply.status(400).send(result);
    return result;
  });

  app.post<{ Body: { color: string | null } }>('/bubble-color', async (request, reply) => {
    const userId = request.user!.userId;
    const color = request.body?.color;
    if (color !== null && (typeof color !== 'string' || !HEX_RE.test(color))) {
      return reply.status(400).send({ error: 'BAD_COLOR', message: '#RRGGBB' });
    }
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { bubbleColor: true } });
    const result = await chargeAndUpdate(
      userId,
      BUBBLE_PRICE,
      !!u?.bubbleColor,
      { bubbleColor: color },
      `Bubble color: ${color ?? 'cleared'}`,
    );
    if ((result as any).error) return reply.status(400).send(result);
    return result;
  });

  app.post<{ Body: { bg: string | null } }>('/profile-bg', async (request, reply) => {
    const userId = request.user!.userId;
    const bg = request.body?.bg;
    if (bg !== null && (typeof bg !== 'string' || !BACKGROUNDS.has(bg))) {
      return reply.status(400).send({ error: 'BAD_BG' });
    }
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { profileBg: true } });
    const result = await chargeAndUpdate(
      userId,
      BG_PRICE,
      !!u?.profileBg,
      { profileBg: bg },
      `Profile background: ${bg ?? 'cleared'}`,
    );
    if ((result as any).error) return reply.status(400).send(result);
    return result;
  });
}
