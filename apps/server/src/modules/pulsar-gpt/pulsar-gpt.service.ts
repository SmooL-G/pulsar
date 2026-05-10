import { prisma } from '../../config/database.js';
import {
  PulsarGptType,
  PulsarGptStatus,
  PulsarGptPaymentMode,
  MerchantTier,
} from '@prisma/client';
import { recordBurn } from '../economy/burn.service.js';
import { chatComplete, createTask, getTaskInfo, createVeoTask, type ChatMessage } from './kie.client.js';
import { generateImageDalle3, DalleError } from './dalle.client.js';
import { priceChatTokens, priceTaskCredits, estimateTaskPls, BURN_PCT_OF_CHARGE } from './pricing.js';

export class PulsarGptError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'PulsarGptError';
  }
}

/**
 * Per-model-family `input` defaults so KIE doesn't reject on missing
 * required fields. Each family has its own quirks — flux2 wants
 * aspect_ratio + resolution, imagen wants aspect_ratio, video models
 * want duration, etc. Caller can still override via `extraInput`.
 */
function buildModelInput(model: string, opts: { prompt?: string; inputUrl?: string }): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  if (opts.prompt) input.prompt = opts.prompt;

  if (model.startsWith('flux-2/')) {
    input.aspect_ratio = '1:1';
    input.resolution = '1K';
    input.nsfw_checker = false;
    // Flux 2 on KIE *requires* input_urls even for text-to-image —
    // pass an empty array when there's no source image; populate it
    // for image-to-image variants.
    input.input_urls = opts.inputUrl && model.includes('image-to-image')
      ? [opts.inputUrl]
      : [];
  } else if (model.startsWith('google/imagen4')) {
    input.aspect_ratio = '1:1';
  } else if (model.startsWith('bytedance/seedance')) {
    input.duration = 5;        // seconds
    input.resolution = '720p';
    input.aspect_ratio = '16:9';
    if (opts.inputUrl) input.image_url = opts.inputUrl;
  } else if (model.startsWith('kling/')) {
    // Kling on KIE expects duration as a STRING ("5"/"10"), not int.
    // Per ref impl, also requires negative_prompt and cfg_scale.
    // Both v2.5-turbo image-to-video and earlier text-to-video use
    // the same input wrapper.
    input.duration = '5';
    input.cfg_scale = 0.5;
    input.negative_prompt = '';
    if (opts.inputUrl && model.includes('image-to-video')) input.image_url = opts.inputUrl;
  } else if (opts.inputUrl) {
    // Generic image-input fallback for any other family.
    input.image_url = opts.inputUrl;
  }

  return input;
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

  // Build KIE input shape — different model families want different
  // shapes. Defaults to merging extraInput (caller-provided overrides)
  // on top of safe per-model defaults.
  const input: Record<string, unknown> = buildModelInput(args.model, {
    prompt: args.prompt,
    inputUrl: args.inputUrl,
  });
  Object.assign(input, args.extraInput ?? {});

  // DALL-E 3 short-circuit: synchronous via relay. Returns a final URL
  // immediately, so we mark the request DONE in one transaction and
  // skip the worker poll loop entirely.
  if (args.model === 'dall-e-3') {
    if (!args.prompt) throw new PulsarGptError('NO_PROMPT', 'DALL-E требует текстовое описание');
    let dalle;
    try {
      dalle = await generateImageDalle3({ prompt: args.prompt });
    } catch (e: any) {
      console.error(`[pulsar-gpt] dalle3 failed: ${e?.message}`);
      throw new PulsarGptError(
        e?.code || 'DALLE_ERROR',
        `DALL-E отказал: ${e?.message || 'unknown error'}`,
      );
    }
    const requestId = await prisma.$transaction(async (tx) => {
      if (!isAdmin) {
        await tx.plsWallet.update({
          where: { userId: args.userId },
          data: { balance: { decrement: estimate.pricePls } },
        });
        if (estimate.burnPls > 0n) {
          await recordBurn(tx, args.userId, estimate.burnPls, `Pulsar GPT image (dall-e-3)`);
        }
      }
      const row = await tx.pulsarGptRequest.create({
        data: {
          userId: args.userId,
          type: PulsarGptType.IMAGE,
          model: dalle.model,
          prompt: args.prompt!.slice(0, 2000),
          inputUrl: null,
          postToChatId: args.postToChatId ?? null,
          outputUrl: dalle.url,
          pricePls: isAdmin ? null : estimate.pricePls,
          paymentMode: isAdmin ? PulsarGptPaymentMode.ADMIN : PulsarGptPaymentMode.PLS,
          status: PulsarGptStatus.DONE,
          completedAt: new Date(),
        },
      });
      return row.id;
    });
    return {
      requestId,
      taskId: requestId,         // no upstream task id, reuse local id
      estimatedPls: isAdmin ? '0' : estimate.pricePls.toString(),
      status: 'DONE' as const,
      outputUrl: dalle.url,
    };
  }

  // Create the upstream task FIRST. If KIE rejects, no debit.
  // Veo models live on a different endpoint with a different payload
  // shape — route them via createVeoTask. Everything else goes through
  // the generic /jobs/createTask flow.
  console.log(`[pulsar-gpt] createTask model=${args.model} input=${JSON.stringify(input).slice(0, 400)}`);
  let taskId: string;
  try {
    if (args.model === 'veo3' || args.model === 'veo3_fast') {
      if (!args.prompt) throw new PulsarGptError('NO_PROMPT', 'Veo требует текстовое описание');
      ({ taskId } = await createVeoTask({
        prompt: args.prompt,
        model: args.model,
        aspectRatio: '16:9',
        ...(args.inputUrl ? { imageUrls: [args.inputUrl] } : {}),
      }));
    } else {
      ({ taskId } = await createTask({ model: args.model, input }));
    }
  } catch (e: any) {
    if (e instanceof PulsarGptError) throw e;
    console.error(`[pulsar-gpt] createTask FAILED model=${args.model} code=${e?.code} msg=${e?.message}`);
    throw new PulsarGptError(
      e?.code || 'KIE_ERROR',
      `KIE отказал: ${e?.message || 'unknown error'}`,
    );
  }

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
