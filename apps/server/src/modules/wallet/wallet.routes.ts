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

  // Transaction history with pagination + filters.
  //
  //   types     — comma-separated PlsTransactionType list to include
  //               (e.g. "DEPOSIT,REWARD"). Empty/missing = all.
  //   direction — "in" | "out". Computed from type + description prefix
  //               since direction isn't a column: REWARD/DEPOSIT and
  //               TRANSFERs starting with "Transfer from" are inbound;
  //               everything else (PURCHASE/WITHDRAWAL/BURN + outgoing
  //               TRANSFERs) is outbound.
  //   q         — case-insensitive substring match on description.
  //   from/to   — ISO date strings, inclusive bounds on createdAt.
  app.get('/history', async (request: FastifyRequest<{
    Querystring: {
      limit?: string;
      offset?: string;
      types?: string;
      direction?: string;
      q?: string;
      from?: string;
      to?: string;
    };
  }>) => {
    const wallet = await getOrCreateWallet(request.user!.userId);
    const limit = Math.min(parseInt(request.query.limit || '20') || 20, 100);
    const offset = parseInt(request.query.offset || '0') || 0;

    const where: any = { walletId: wallet.id };

    const ALLOWED_TYPES = ['DEPOSIT', 'WITHDRAWAL', 'PURCHASE', 'REWARD', 'TRANSFER', 'BURN'];
    if (request.query.types) {
      const wanted = request.query.types
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => ALLOWED_TYPES.includes(s));
      if (wanted.length > 0) where.type = { in: wanted };
    }

    if (request.query.q) {
      where.description = { contains: request.query.q, mode: 'insensitive' };
    }

    if (request.query.from || request.query.to) {
      where.createdAt = {};
      if (request.query.from) {
        const d = new Date(request.query.from);
        if (!isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (request.query.to) {
        const d = new Date(request.query.to);
        if (!isNaN(d.getTime())) where.createdAt.lte = d;
      }
    }

    // direction filter (post-query — can't be expressed cleanly as
    // SQL with the current schema). Fetch a wider page and slice.
    const direction = request.query.direction?.toLowerCase();
    const usesDirection = direction === 'in' || direction === 'out';
    const fetchTake = usesDirection ? limit * 4 : limit;
    const fetchSkip = usesDirection ? 0 : offset;

    const [rawTransactions, total] = await Promise.all([
      prisma.plsTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: fetchTake,
        skip: fetchSkip,
      }),
      prisma.plsTransaction.count({ where }),
    ]);

    const isInbound = (tx: { type: string; description: string | null }) => {
      if (tx.type === 'DEPOSIT' || tx.type === 'REWARD') return true;
      if (tx.type === 'TRANSFER') {
        return !!tx.description && /^Transfer from/i.test(tx.description);
      }
      return false;
    };

    let filtered = rawTransactions;
    if (usesDirection) {
      filtered = rawTransactions.filter((tx) =>
        direction === 'in' ? isInbound(tx) : !isInbound(tx),
      );
      filtered = filtered.slice(offset, offset + limit);
    }

    return {
      transactions: filtered.map((tx) => ({
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

    // Drop a SYSTEM message with plsTransfer metadata into the DM
    // between sender & recipient so the transfer is visible in chat
    // (Telegram-style "Sent 100 PLS" bubble). If no DM exists yet we
    // create one — a money transfer is enough context to warrant a
    // conversation thread.
    try {
      let dm = await prisma.chat.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId: fromUserId, leftAt: null } } },
            { members: { some: { userId: toUserId, leftAt: null } } },
          ],
        },
        select: { id: true },
      });
      if (!dm) {
        const created = await prisma.chat.create({
          data: {
            type: 'DIRECT',
            members: {
              create: [
                { userId: fromUserId, role: 'MEMBER' },
                { userId: toUserId, role: 'MEMBER' },
              ],
            },
          },
          select: { id: true },
        });
        dm = created;
        // The chat was created mid-session, so neither user's
        // already-connected socket has joined `chat:<id>` yet (that
        // join happens at connect). Force both into the new room so
        // the upcoming `message:new` emit reaches them.
        try {
          const io = getIO();
          await io.in(`user:${fromUserId}`).socketsJoin(`chat:${created.id}`);
          await io.in(`user:${toUserId}`).socketsJoin(`chat:${created.id}`);
        } catch {}
      }
      if (dm) {
        const sysMsg = await prisma.message.create({
          data: {
            chatId: dm.id,
            senderId: fromUserId,
            type: 'SYSTEM',
            content: null,
            metadata: {
              plsTransfer: {
                fromUserId,
                toUserId,
                amount: plsAmount.toString(),
                received: receivedAmount.toString(),
                fee: fee.toString(),
              },
            },
          },
          include: {
            sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        });
        await prisma.chat.update({
          where: { id: dm.id },
          data: { updatedAt: new Date() },
        });
        try {
          const io = getIO();
          io.to(`chat:${dm.id}`).emit('message:new', {
            id: sysMsg.id,
            chatId: dm.id,
            senderId: sysMsg.senderId,
            content: null,
            type: 'SYSTEM',
            replyToId: null,
            isEdited: false,
            isDeleted: false,
            metadata: sysMsg.metadata as any,
            signature: null,
            signerWallet: null,
            encryptedContent: null,
            encryptionType: null,
            createdAt: sysMsg.createdAt.toISOString(),
            updatedAt: sysMsg.updatedAt.toISOString(),
            sender: sysMsg.sender,
            status: 'sent',
            attachments: [],
          } as any);
        } catch {}
      }
    } catch (e) {
      // Non-fatal — the transfer itself succeeded.
      request.log.warn({ err: e }, 'wallet/transfer: failed to post chat system message');
    }

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

    // Referral registration bonus is gated on Verification Level 1
    // (anti-empty-account). The first time a user crosses that line,
    // both they and their referrer get the tier-based PLS bonus.
    if (updatedUser.verificationLevel >= 1) {
      try {
        const { grantRegistrationBonusIfReady } = await import(
          '../referrals/referrals.service.js'
        );
        await grantRegistrationBonusIfReady(userId);
      } catch (err) {
        console.error('[referrals] grant-on-verify failed:', err);
      }
    }

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
      select: { nickColor: true, avatarFrame: true, bubbleColor: true, verificationLevel: true },
    });
    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });

    // Already owned — free to change
    if (user.nickColor) {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { nickColor: color },
        select: { id: true, nickColor: true, avatarFrame: true, bubbleColor: true },
      });
      return { success: true, nickColor: updated.nickColor, charged: false };
    }

    // Pro+ verification (level 2+) gets it free
    const isFree = user.verificationLevel >= 2;

    if (isFree) {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { nickColor: color },
        select: { id: true, nickColor: true, avatarFrame: true, bubbleColor: true },
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
        select: { id: true, nickColor: true, avatarFrame: true, bubbleColor: true },
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

  // ─── PREMIUM SUBSCRIPTION ───────────────────────────────────
  // Status of the current user's subscription (or null).
  app.get('/subscription', async (request) => {
    const userId = request.user!.userId;
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { premiumTrialUsed: true },
    });
    const active = !!sub && sub.expiresAt.getTime() > Date.now();
    return {
      subscription: sub,
      active,
      isPremium: active,
      trialUsed: !!user?.premiumTrialUsed,
      pricePls: '5000',
      trialDays: 7,
    };
  });

  // Subscribe (or renew) Premium for 30 days. Charges 5000 PLS.
  app.post('/subscribe', async (request, reply) => {
    const { PREMIUM_MONTH_PRICE_PLS, PREMIUM_PERIOD_DAYS } =
      await import('../subscription/premium.service.js');
    const userId = request.user!.userId;

    const wallet = await prisma.plsWallet.findUnique({ where: { userId } });
    if (!wallet) return reply.status(400).send({ error: 'NO_WALLET' });
    if (wallet.balance < PREMIUM_MONTH_PRICE_PLS) {
      return reply.status(402).send({
        error: 'INSUFFICIENT_BALANCE',
        message: `Need ${PREMIUM_MONTH_PRICE_PLS} PLS`,
        balance: wallet.balance.toString(),
      });
    }

    const existing = await prisma.subscription.findUnique({ where: { userId } });
    // If still active, extend from current expiresAt; otherwise from now.
    const baseTime = existing && existing.expiresAt.getTime() > Date.now()
      ? existing.expiresAt.getTime()
      : Date.now();
    const newExpires = new Date(baseTime + PREMIUM_PERIOD_DAYS * 24 * 3600 * 1000);

    const [updatedWallet, sub] = await prisma.$transaction([
      prisma.plsWallet.update({
        where: { userId },
        data: { balance: { decrement: PREMIUM_MONTH_PRICE_PLS } },
      }),
      prisma.subscription.upsert({
        where: { userId },
        create: { userId, plan: 'premium', expiresAt: newExpires, autoRenew: true, isTrial: false },
        update: { expiresAt: newExpires, autoRenew: true, isTrial: false },
      }),
    ]);

    return { success: true, subscription: sub, balance: updatedWallet.balance.toString() };
  });

  // Activate the one-time 7-day free trial.
  app.post('/subscribe/trial', async (request, reply) => {
    const { PREMIUM_TRIAL_DAYS } = await import('../subscription/premium.service.js');
    const userId = request.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { premiumTrialUsed: true },
    });
    if (user?.premiumTrialUsed) {
      return reply.status(400).send({ error: 'TRIAL_ALREADY_USED' });
    }

    const existing = await prisma.subscription.findUnique({ where: { userId } });
    if (existing && existing.expiresAt.getTime() > Date.now()) {
      return reply.status(400).send({ error: 'ALREADY_SUBSCRIBED' });
    }

    const expires = new Date(Date.now() + PREMIUM_TRIAL_DAYS * 24 * 3600 * 1000);
    const [, sub] = await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { premiumTrialUsed: true } }),
      prisma.subscription.upsert({
        where: { userId },
        // Trial defaults to autoRenew=false — at the end the user must
        // actively subscribe; no surprise charges from a forgotten trial.
        create: { userId, plan: 'premium', expiresAt: expires, autoRenew: false, isTrial: true },
        update: { expiresAt: expires, autoRenew: false, isTrial: true },
      }),
    ]);

    return { success: true, subscription: sub };
  });

  // Toggle auto-renew without ending the current paid period.
  app.post('/subscribe/cancel', async (request, reply) => {
    const userId = request.user!.userId;
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return reply.status(404).send({ error: 'NOT_SUBSCRIBED' });
    const updated = await prisma.subscription.update({
      where: { userId },
      data: { autoRenew: false },
    });
    return { success: true, subscription: updated };
  });

  // ─── YOOKASSA TOP-UP ────────────────────────────────────────
  // List of available packages (used by the deposit modal grid).
  app.get('/topup/packages', async () => {
    const { PLS_PACKAGES } = await import('./yookassa.service.js');
    return { packages: PLS_PACKAGES };
  });

  // Create a YooKassa payment for a chosen package; returns redirect URL.
  app.post<{ Body: { amountPls: number; returnPath?: string } }>(
    '/topup/create',
    async (request, reply) => {
      const { findPackage, createPayment } = await import('./yookassa.service.js');
      const { amountPls, returnPath } = request.body;
      const pack = findPackage(amountPls);
      if (!pack) return reply.status(400).send({ error: 'INVALID_PACKAGE' });

      const userId = request.user!.userId;
      const origin = (request.headers.origin as string) || 'https://pulsar-chat.fun';
      const returnUrl = `${origin}${returnPath || '/?topup=ok'}`;
      try {
        const result = await createPayment({ userId, pack, returnUrl });
        return result;
      } catch (err: any) {
        return reply.status(500).send({ error: 'YOOKASSA_ERROR', message: err.message });
      }
    },
  );

  // Polled by the frontend after YooKassa redirects the user back.
  // Idempotent: credits PLS on the first call, returns the row on subsequent ones.
  app.get<{ Params: { id: string } }>('/topup/check/:id', async (request, reply) => {
    const { fetchPaymentStatus, markPaidAndCredit } = await import('./yookassa.service.js');
    const userId = request.user!.userId;
    const purchase = await prisma.plsPurchase.findUnique({
      where: { yookassaPaymentId: request.params.id },
    });
    if (!purchase || purchase.userId !== userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }
    if (purchase.status !== 'PAID') {
      try {
        const yk = await fetchPaymentStatus(request.params.id);
        if (yk.paid && yk.status === 'succeeded') {
          await markPaidAndCredit(request.params.id);
        } else if (yk.status === 'canceled') {
          await prisma.plsPurchase.update({
            where: { id: purchase.id },
            data: { status: 'CANCELLED' },
          });
        }
      } catch { /* keep PENDING; user can retry */ }
    }
    const fresh = await prisma.plsPurchase.findUnique({
      where: { yookassaPaymentId: request.params.id },
    });
    return { purchase: fresh };
  });

  // Re-enable auto-renew on an active subscription.
  app.post('/subscribe/resume', async (request, reply) => {
    const userId = request.user!.userId;
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return reply.status(404).send({ error: 'NOT_SUBSCRIBED' });
    if (sub.expiresAt.getTime() <= Date.now()) {
      return reply.status(400).send({ error: 'EXPIRED', message: 'Subscribe again first' });
    }
    const updated = await prisma.subscription.update({
      where: { userId },
      data: { autoRenew: true },
    });
    return { success: true, subscription: updated };
  });
}
