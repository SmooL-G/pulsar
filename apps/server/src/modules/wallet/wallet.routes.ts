import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { authMiddleware } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getIO } from '../../socket/index.js';

const PLS_PER_SOL = 100_000;

async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.plsWallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.plsWallet.create({ data: { userId } });
  }
  return wallet;
}

export async function walletRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // Get PLS balance
  app.get('/', async (request) => {
    const wallet = await getOrCreateWallet(request.user!.userId);
    const recentTx = await prisma.plsTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      balance: wallet.balance.toString(),
      transactions: recentTx.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.toString(),
        solAmount: tx.solAmount?.toString() || null,
        description: tx.description,
        status: tx.status,
        createdAt: tx.createdAt.toISOString(),
      })),
    };
  });

  // Transaction history with pagination
  app.get('/history', async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string };
  }>) => {
    const wallet = await getOrCreateWallet(request.user!.userId);
    const limit = Math.min(parseInt(request.query.limit || '20') || 20, 100);
    const offset = parseInt(request.query.offset || '0') || 0;

    const [transactions, total] = await Promise.all([
      prisma.plsTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.plsTransaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.toString(),
        solAmount: tx.solAmount?.toString() || null,
        solSignature: tx.solSignature,
        description: tx.description,
        status: tx.status,
        createdAt: tx.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  });

  // Deposit SOL → PLS
  app.post('/deposit', async (request: FastifyRequest<{
    Body: { solSignature: string; solAmount: number };
  }>, reply) => {
    const { solSignature, solAmount } = request.body as { solSignature: string; solAmount: number };

    if (!solSignature || !solAmount || solAmount < 0.01) {
      return reply.status(400).send({ error: 'INVALID', message: 'Invalid deposit params. Min 0.01 SOL' });
    }

    if (!env.PLATFORM_WALLET_ADDRESS) {
      return reply.status(500).send({ error: 'CONFIG', message: 'Platform wallet not configured' });
    }

    // Check if signature already used
    const existing = await prisma.plsTransaction.findUnique({
      where: { solSignature },
    });
    if (existing) {
      return reply.status(400).send({ error: 'DUPLICATE', message: 'Transaction already processed' });
    }

    // Verify Solana transaction
    try {
      const connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
      const tx = await connection.getTransaction(solSignature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta) {
        return reply.status(400).send({ error: 'NOT_FOUND', message: 'Transaction not found on chain' });
      }

      if (tx.meta.err) {
        return reply.status(400).send({ error: 'FAILED', message: 'Transaction failed on chain' });
      }

      // Verify recipient is platform wallet
      const accountKeys = tx.transaction.message.getAccountKeys();
      const platformKey = new PublicKey(env.PLATFORM_WALLET_ADDRESS);
      let foundTransfer = false;
      let transferredLamports = 0;

      // Check pre/post balances for the platform wallet
      for (let i = 0; i < accountKeys.length; i++) {
        if (accountKeys.get(i)?.equals(platformKey)) {
          const preBal = tx.meta.preBalances[i];
          const postBal = tx.meta.postBalances[i];
          if (postBal > preBal) {
            transferredLamports = postBal - preBal;
            foundTransfer = true;
          }
          break;
        }
      }

      if (!foundTransfer) {
        return reply.status(400).send({ error: 'INVALID_RECIPIENT', message: 'Transfer to platform wallet not found' });
      }

      const actualSol = transferredLamports / LAMPORTS_PER_SOL;
      // Allow 5% tolerance for fees
      if (actualSol < solAmount * 0.95) {
        return reply.status(400).send({ error: 'AMOUNT_MISMATCH', message: 'SOL amount does not match' });
      }

      const plsAmount = BigInt(Math.floor(actualSol * PLS_PER_SOL));

      // Credit wallet
      const wallet = await getOrCreateWallet(request.user!.userId);

      const [updatedWallet, transaction] = await prisma.$transaction([
        prisma.plsWallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: plsAmount } },
        }),
        prisma.plsTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEPOSIT',
            amount: plsAmount,
            solAmount: actualSol,
            solSignature,
            description: `Deposit ${actualSol} SOL → ${plsAmount.toString()} PLS`,
            status: 'COMPLETED',
          },
        }),
      ]);

      // Emit real-time balance update
      try {
        const io = getIO();
        io.to(`user:${request.user!.userId}`).emit('wallet:balance-updated', {
          balance: updatedWallet.balance.toString(),
          change: `+${plsAmount.toString()}`,
          type: 'DEPOSIT' as const,
        });
      } catch {}

      return {
        success: true,
        balance: updatedWallet.balance.toString(),
        credited: plsAmount.toString(),
        transaction: {
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount.toString(),
          solAmount: transaction.solAmount?.toString(),
          createdAt: transaction.createdAt.toISOString(),
        },
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'VERIFY_FAILED', message: 'Failed to verify transaction' });
    }
  });

  // Перевод PLS другому пользователю
  app.post('/transfer', async (request: FastifyRequest<{
    Body: { toUserId: string; amount: number };
  }>, reply) => {
    const fromUserId = request.user!.userId;
    const { toUserId, amount } = request.body as { toUserId: string; amount: number };

    if (!toUserId || !amount || amount < 1) {
      return reply.status(400).send({ error: 'INVALID', message: 'Invalid transfer params. Min 1 PLS' });
    }

    if (fromUserId === toUserId) {
      return reply.status(400).send({ error: 'SELF_TRANSFER', message: 'Cannot transfer to yourself' });
    }

    const plsAmount = BigInt(Math.floor(amount));

    // Burn fee: 2%, min 1 PLS, max 10000 PLS
    const FEE_PERCENT = 2n;
    const MIN_FEE = 1n;
    const MAX_FEE = 10000n;
    const rawFee = plsAmount * FEE_PERCENT / 100n;
    const fee = rawFee < MIN_FEE ? MIN_FEE : rawFee > MAX_FEE ? MAX_FEE : rawFee;
    const receivedAmount = plsAmount - fee;

    // Проверяем что получатель существует
    const recipient = await prisma.user.findUnique({
      where: { id: toUserId, status: 'ACTIVE' },
      select: { id: true, username: true },
    });
    if (!recipient) {
      return reply.status(404).send({ error: 'USER_NOT_FOUND', message: 'Recipient not found' });
    }

    const fromWallet = await getOrCreateWallet(fromUserId);
    if (fromWallet.balance < plsAmount) {
      return reply.status(400).send({ error: 'INSUFFICIENT', message: 'Not enough PLS' });
    }

    const toWallet = await getOrCreateWallet(toUserId);

    const sender = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: { username: true },
    });

    // Атомарный перевод: списать plsAmount, зачислить receivedAmount (fee сгорает)
    const [updatedFromWallet, updatedToWallet] = await prisma.$transaction([
      prisma.plsWallet.update({
        where: { id: fromWallet.id },
        data: { balance: { decrement: plsAmount } },
      }),
      prisma.plsWallet.update({
        where: { id: toWallet.id },
        data: { balance: { increment: receivedAmount } },
      }),
      prisma.plsTransaction.create({
        data: {
          walletId: fromWallet.id,
          type: 'TRANSFER',
          amount: plsAmount,
          description: `Transfer to @${recipient.username} (fee: ${fee} PLS burned)`,
          status: 'COMPLETED',
        },
      }),
      prisma.plsTransaction.create({
        data: {
          walletId: toWallet.id,
          type: 'TRANSFER',
          amount: receivedAmount,
          description: `Transfer from @${sender?.username || 'unknown'}`,
          status: 'COMPLETED',
        },
      }),
    ]);

    // Уведомляем обоих через сокет
    try {
      const io = getIO();
      io.to(`user:${fromUserId}`).emit('wallet:balance-updated', {
        balance: updatedFromWallet.balance.toString(),
        change: `-${plsAmount.toString()}`,
        type: 'TRANSFER' as const,
      });
      io.to(`user:${toUserId}`).emit('wallet:balance-updated', {
        balance: updatedToWallet.balance.toString(),
        change: `+${plsAmount.toString()}`,
        type: 'TRANSFER' as const,
      });
    } catch {}

    return {
      success: true,
      balance: updatedFromWallet.balance.toString(),
      transferred: plsAmount.toString(),
      received: receivedAmount.toString(),
      fee: fee.toString(),
      toUser: recipient.username,
    };
  });

  // Purchase verification level
  const VERIFICATION_PRICES: Record<number, bigint> = {
    1: BigInt(1000),
    2: BigInt(5000),
    3: BigInt(25000),
  };

  app.post('/purchase-verification', async (request: FastifyRequest<{
    Body: { level: number };
  }>, reply) => {
    const userId = request.user!.userId;
    const { level } = request.body as { level: number };

    if (![1, 2, 3].includes(level)) {
      return reply.status(400).send({ error: 'INVALID', message: 'Level must be 1, 2 or 3' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { verificationLevel: true } });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (user.verificationLevel >= level) {
      return reply.status(400).send({ error: 'ALREADY_HAVE', message: 'You already have this level or higher' });
    }

    const price = VERIFICATION_PRICES[level];
    const wallet = await getOrCreateWallet(userId);

    if (wallet.balance < price) {
      return reply.status(400).send({ error: 'INSUFFICIENT', message: 'Not enough PLS' });
    }

    // Deduct PLS and upgrade level
    const [updatedWallet, , updatedUser] = await prisma.$transaction([
      prisma.plsWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: price } },
      }),
      prisma.plsTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PURCHASE',
          amount: price,
          description: `Verification Lv.${level}`,
          status: 'COMPLETED',
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { verificationLevel: level },
        select: { id: true, verificationLevel: true },
      }),
    ]);

    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('wallet:balance-updated', {
        balance: updatedWallet.balance.toString(),
        change: `-${price.toString()}`,
        type: 'PURCHASE' as const,
      });
    } catch {}

    return {
      success: true,
      balance: updatedWallet.balance.toString(),
      verificationLevel: updatedUser.verificationLevel,
    };
  });

  // Purchase profile badge
  const BADGE_PRICES: Record<string, bigint> = {
    BLOGGER: BigInt(10000),
    AUTHOR: BigInt(10000),
    BUSINESS: BigInt(50000),
  };

  app.post('/purchase-badge', async (request: FastifyRequest<{
    Body: { badge: string };
  }>, reply) => {
    const userId = request.user!.userId;
    const { badge } = request.body as { badge: string };

    if (!BADGE_PRICES[badge]) {
      return reply.status(400).send({ error: 'INVALID', message: 'Invalid badge type' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileBadge: true } });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });

    if (user.profileBadge === badge) {
      return reply.status(400).send({ error: 'ALREADY_HAVE', message: 'You already have this badge' });
    }

    const price = BADGE_PRICES[badge];
    const wallet = await getOrCreateWallet(userId);

    if (wallet.balance < price) {
      return reply.status(400).send({ error: 'INSUFFICIENT', message: 'Not enough PLS' });
    }

    const [updatedWallet, , updatedUser] = await prisma.$transaction([
      prisma.plsWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: price } },
      }),
      prisma.plsTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PURCHASE',
          amount: price,
          description: `Profile Badge: ${badge}`,
          status: 'COMPLETED',
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { profileBadge: badge },
        select: { id: true, profileBadge: true },
      }),
    ]);

    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('wallet:balance-updated', {
        balance: updatedWallet.balance.toString(),
        change: `-${price.toString()}`,
        type: 'PURCHASE' as const,
      });
    } catch {}

    return {
      success: true,
      balance: updatedWallet.balance.toString(),
      profileBadge: updatedUser.profileBadge,
    };
  });

  // Custom nickname color (one-time purchase, then free to change)
  const NICK_COLOR_PRICE = BigInt(2000);
  const HEX_RE = /^#([0-9a-fA-F]{6})$/;

  app.post('/purchase-nick-color', async (request: FastifyRequest<{
    Body: { color: string };
  }>, reply) => {
    const userId = request.user!.userId;
    const { color } = request.body;

    if (!color || !HEX_RE.test(color)) {
      return reply.status(400).send({ error: 'INVALID_COLOR', message: 'Color must be #RRGGBB hex' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { nickColor: true, verificationLevel: true },
    });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Already owned — free to change
    if (user.nickColor) {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { nickColor: color },
        select: { id: true, nickColor: true },
      });
      return { success: true, nickColor: updated.nickColor, charged: false };
    }

    // Pro+ verification (level 2+) gets it free
    const isFree = user.verificationLevel >= 2;

    if (isFree) {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { nickColor: color },
        select: { id: true, nickColor: true },
      });
      return { success: true, nickColor: updated.nickColor, charged: false, reason: 'PRO_INCLUDED' };
    }

    // Charge PLS
    const wallet = await getOrCreateWallet(userId);
    if (wallet.balance < NICK_COLOR_PRICE) {
      return reply.status(400).send({
        error: 'INSUFFICIENT',
        message: `Need ${NICK_COLOR_PRICE} PLS (or upgrade to Pro for free)`,
      });
    }

    const [updatedWallet, , updatedUser] = await prisma.$transaction([
      prisma.plsWallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: NICK_COLOR_PRICE } },
      }),
      prisma.plsTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'PURCHASE',
          amount: NICK_COLOR_PRICE,
          description: `Custom nickname color: ${color}`,
          status: 'COMPLETED',
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { nickColor: color },
        select: { id: true, nickColor: true },
      }),
    ]);

    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('wallet:balance-updated', {
        balance: updatedWallet.balance.toString(),
        change: `-${NICK_COLOR_PRICE.toString()}`,
        type: 'PURCHASE' as const,
      });
    } catch {}

    return {
      success: true,
      balance: updatedWallet.balance.toString(),
      nickColor: updatedUser.nickColor,
      charged: true,
    };
  });

  // SuperChat — donate message in group/channel
  app.post('/superchat', async (request: FastifyRequest<{
    Body: { chatId: string; content: string; amount: number };
  }>, reply) => {
    const userId = request.user!.userId;
    const { chatId, content, amount } = request.body;

    if (!chatId || !content?.trim() || !amount || amount < 100) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Min amount is 100 PLS' });
    }

    // Check membership
    const member = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!member || member.leftAt) {
      return reply.status(403).send({ error: 'NOT_MEMBER' });
    }

    // Check balance
    const wallet = await getOrCreateWallet(userId);
    if (wallet.balance < BigInt(amount)) {
      return reply.status(400).send({ error: 'INSUFFICIENT_BALANCE' });
    }

    // Get chat owner for revenue split
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { ownerId: true, type: true },
    });

    // Determine tier
    const tier = amount >= 25000 ? 'red' : amount >= 5000 ? 'yellow' : amount >= 1000 ? 'green' : 'blue';
    const pinDuration = amount >= 25000 ? 30 : amount >= 5000 ? 5 : amount >= 1000 ? 1 : 0; // minutes

    // Deduct from sender
    const burnAmount = Math.floor(amount * 0.3); // 30% burn
    const ownerAmount = amount - burnAmount; // 70% to chat owner

    const updatedWallet = await prisma.plsWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: BigInt(amount) } },
    });

    // Record transaction for sender
    await prisma.plsTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'PURCHASE',
        amount: BigInt(-amount),
        description: `SuperChat in ${chat?.type || 'chat'}: ${amount} PLS`,
      },
    });

    // Give 70% to chat owner (if exists and not self)
    if (chat?.ownerId && chat.ownerId !== userId) {
      const ownerWallet = await getOrCreateWallet(chat.ownerId);
      await prisma.plsWallet.update({
        where: { id: ownerWallet.id },
        data: { balance: { increment: BigInt(ownerAmount) } },
      });
      await prisma.plsTransaction.create({
        data: {
          walletId: ownerWallet.id,
          type: 'REWARD',
          amount: BigInt(ownerAmount),
          description: `SuperChat received: ${ownerAmount} PLS`,
        },
      });

      try {
        const io = getIO();
        io.to(`user:${chat.ownerId}`).emit('wallet:balance-updated', {
          balance: (ownerWallet.balance + BigInt(ownerAmount)).toString(),
          change: `+${ownerAmount}`,
          type: 'REWARD' as const,
        });
      } catch {}
    }

    // Create superchat message
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: content.trim(),
        type: 'TEXT',
        metadata: {
          superchat: { amount, tier, pinDuration },
        },
      },
      include: {
        sender: {
          select: {
            id: true, username: true, displayName: true, avatarUrl: true,
            verificationLevel: true, profileBadge: true, nickColor: true, nftAvatarMint: true, role: true,
          },
        },
      },
    });

    // Broadcast via Socket.IO
    try {
      const io = getIO();
      io.to(`chat:${chatId}`).emit('message:new', {
        ...message,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
        status: 'sent',
      } as any);

      // Notify sender of balance change
      io.to(`user:${userId}`).emit('wallet:balance-updated', {
        balance: updatedWallet.balance.toString(),
        change: `-${amount}`,
        type: 'PURCHASE' as const,
      });
    } catch {}

    return {
      success: true,
      messageId: message.id,
      tier,
      balance: updatedWallet.balance.toString(),
    };
  });
}
