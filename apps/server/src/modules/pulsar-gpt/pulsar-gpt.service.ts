import { prisma } from '../../config/database.js';
import {
  PulsarGptType,
  PulsarGptStatus,
  PulsarGptPaymentMode,
  MerchantTier,
} from '@prisma/client';
import { recordBurn } from '../economy/burn.service.js';
import { chatComplete, createTask, getTaskInfo, type ChatMessage } from './kie.client.js';
import { priceChatTokens, priceTaskCredits, estimateTaskPls, BURN_PCT_OF_CHARGE } from './pricing.js';

export class PulsarGptError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'PulsarGptError';
  }
}

/**
 * Run a chat completion through KIE.AI, debit PLS atomically and log
 * the request. Pricing is metered against actual token usage returned
 * by the upstream — user pays exactly for what they consumed plus the
 * 25% platform margin.
 *
 * SUPER_ADMIN bypasses debit entirely (free for the platform owner).
 */
export async function runChat(args: {
  userId: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
}) {
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { role: true, merchantTier: true },
  });
  if (!user) throw new PulsarGptError('NOT_FOUND', 'User not found');
  const isAdmin = user.role === 'SUPER_ADMIN';

  // Make the upstream call FIRST. If it fails, no debit.
  const reply = await chatComplete({
    model: args.model,
    messages: args.messages,
    maxTokens: args.maxTokens,
  });

  const price = priceChatTokens({
    model: reply.model,
    promptTokens: reply.promptTokens,
    completionTokens: reply.completionTokens,
    tier: user.merchantTier,
  });

  await prisma.$transaction(async (tx) => {
    if (!isAdmin) {
      const wallet = await tx.plsWallet.findUnique({ where: { userId: args.userId } });
      if (!wallet) throw new PulsarGptError('NO_WALLET', 'No PLS wallet');
      const spendable = wallet.balance - wallet.lockedAmount;
      if (spendable < price.pricePls) {
        throw new PulsarGptError(
          'INSUFFICIENT_BALANCE',
          `Need ${price.pricePls} PLS, have ${spendable} spendable`,
        );
      }
      await tx.plsWallet.update({
        where: { userId: args.userId },
        data: { balance: { decrement: price.pricePls } },
      });
      // 10% of every charge → burn (defensive token-supply move)
      if (price.burnPls > 0n) {
        await recordBurn(tx, args.userId, price.burnPls, `Pulsar GPT chat (${reply.model})`);
      }
    }

    await tx.pulsarGptRequest.create({
      data: {
        userId: args.userId,
        type: PulsarGptType.CHAT,
        model: reply.model,
        prompt: args.messages[args.messages.length - 1]?.content?.slice(0, 2000) ?? null,
        outputUrl: null,
        pricePls: isAdmin ? null : price.pricePls,
        paymentMode: isAdmin ? PulsarGptPaymentMode.ADMIN : PulsarGptPaymentMode.PLS,
        status: PulsarGptStatus.DONE,
        completedAt: new Date(),
      },
    });
  });

  return {
    text: reply.text,
    model: reply.model,
    tokens: reply.totalTokens,
    pricePls: isAdmin ? '0' : price.pricePls.toString(),
    burnPls: isAdmin ? '0' : price.burnPls.toString(),
    isAdminBypass: isAdmin,
  };
}

/**
 * Kick off an async generation task (image / animate / video). Charges
 * the user upfront with the static credit-based estimate; if the actual
 * cost ends up lower, we keep the difference as platform margin (we
 * already added 25% on top, so this is rare). On task failure the
 * worker refunds the full charge — see runPollWorker().
 */
export async function startTask(args: {
  userId: string;
  type: 'IMAGE' | 'ANIMATE' | 'VIDEO';
  model: string;
  prompt?: string;
  inputUrl?: string;
  extraInput?: Record<string, unknown>;
  /** When set, worker posts the finished result as a bot message in this chat. */
  postToChatId?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { role: true, merchantTier: true },
  });
  if (!user) throw new PulsarGptError('NOT_FOUND', 'User not found');
  const isAdmin = user.role === 'SUPER_ADMIN';

  // Estimate price + check balance BEFORE we spend any KIE credits.
  const estimate = priceTaskCredits({ model: args.model, tier: user.merchantTier });
  if (!isAdmin) {
    const wallet = await prisma.plsWallet.findUnique({ where: { userId: args.userId } });
    if (!wallet) throw new PulsarGptError('NO_WALLET', 'No PLS wallet');
    const spendable = wallet.balance - wallet.lockedAmount;
    if (spendable < estimate.pricePls) {
      throw new PulsarGptError(
        'INSUFFICIENT_BALANCE',
        `Need ${estimate.pricePls} PLS, have ${spendable} spendable`,
      );
    }
  }

  // Build KIE input shape from our generic args.
  const input: Record<string, unknown> = { ...(args.extraInput ?? {}) };
  if (args.prompt) input.prompt = args.prompt;
  if (args.inputUrl) input.image_url = args.inputUrl;

  // Create the upstream task FIRST. If KIE rejects, no debit.
  const { taskId } = await createTask({ model: args.model, input });

  // Debit + create local request row in one transaction.
  const requestId = await prisma.$transaction(async (tx) => {
    if (!isAdmin) {
      await tx.plsWallet.update({
        where: { userId: args.userId },
        data: { balance: { decrement: estimate.pricePls } },
      });
      if (estimate.burnPls > 0n) {
        await recordBurn(tx, args.userId, estimate.burnPls, `Pulsar GPT ${args.type.toLowerCase()} (${args.model})`);
      }
    }
    const row = await tx.pulsarGptRequest.create({
      data: {
        userId: args.userId,
        type: args.type as any,
        model: args.model,
        prompt: args.prompt?.slice(0, 2000) ?? null,
        inputUrl: args.inputUrl ?? null,
        postToChatId: args.postToChatId ?? null,
        kieTaskId: taskId,
        pricePls: isAdmin ? null : estimate.pricePls,
        paymentMode: isAdmin ? 'ADMIN' : 'PLS',
        status: 'PENDING',
      },
    });
    return row.id;
  });

  return {
    requestId,
    taskId,
    estimatedPls: isAdmin ? '0' : estimate.pricePls.toString(),
    status: 'PENDING' as const,
  };
}

/** Get a request by id (only owner can read). */
export async function getRequest(requestId: string, userId: string) {
  const row = await prisma.pulsarGptRequest.findUnique({ where: { id: requestId } });
  if (!row || row.userId !== userId) return null;
  return {
    id: row.id,
    type: row.type,
    model: row.model,
    prompt: row.prompt,
    inputUrl: row.inputUrl,
    outputUrl: row.outputUrl,
    pricePls: row.pricePls?.toString() ?? null,
    status: row.status,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

/** User's current Pulsar GPT settings (model picks for each category). */
export async function getUserSettings(userId: string) {
  const existing = await prisma.pulsarGptUserSettings.findUnique({ where: { userId } });
  if (existing) return existing;
  // Lazy-init with defaults so first read always returns a row.
  return prisma.pulsarGptUserSettings.create({ data: { userId } });
}

export async function updateUserSettings(userId: string, patch: {
  chatModel?: string;
  imageModel?: string;
  animateModel?: string;
  videoModel?: string;
}) {
  return prisma.pulsarGptUserSettings.upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
}

/** Recent history (last 50). */
export async function listHistory(userId: string, limit = 50) {
  const rows = await prisma.pulsarGptRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
    select: {
      id: true, type: true, model: true, prompt: true, outputUrl: true,
      pricePls: true, status: true, errorMessage: true, createdAt: true, completedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    pricePls: r.pricePls?.toString() ?? null,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  }));
}
