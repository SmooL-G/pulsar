/**
 * Pulsar GPT pricing — converts KIE.AI cost (credits or tokens) into
 * the user-facing PLS/RUB price with a 25% platform margin built in.
 *
 * Two strategies:
 *   1. Chat: cost is computed from token usage * model rate, since
 *      the chat endpoint returns it instantly in `usage`.
 *   2. Image/video/audio: cost is the credit delta on our KIE balance
 *      around the call. Worker reads balance before+after and writes
 *      the actual cost into PulsarGptRequest.creditsCost.
 *
 * Falls back to MODEL_PRICE_OVERRIDES when we know the static credit
 * cost upfront (e.g. fixed-price models). User is charged the higher
 * of (estimated) and (actual + 25%) to avoid platform losses.
 */

import { MerchantTier } from '@prisma/client';

export const PLATFORM_MARGIN = 0.25;            // 25% on top of cost
export const BURN_PCT_OF_CHARGE = 0.10;         // 10% of every PLS charge → burn

// PLS-per-USD anchor — keeps in sync with current presale value.
// When PLS_USD_RATE changes, this changes too. The two are kept here
// (instead of fetching live from /api/v1/price every call) so we don't
// add a network hop to the hot path.
const PLS_PER_USD = 1000;                       // 1 PLS ≈ $0.001

// Rough KIE credit → USD equivalence based on observed pricing
// ("typically 30-50% lower than official APIs"). Treat 1 credit ≈ $0.001
// as starting estimate; tighten after first 1000 real calls.
const USD_PER_CREDIT = 0.001;

// Token-based pricing for chat models: USD per 1M tokens, **charged at
// upstream cost**. Margin is added on top via PLATFORM_MARGIN.
// Source: KIE marketplace cards; tighten as data accumulates.
export const CHAT_PRICE_USD_PER_1M: Record<string, { input: number; output: number }> = {
  'deepseek-chat':       { input: 0.14, output: 0.28 },
  'deepseek-v4-flash':   { input: 0.14, output: 0.28 },
  'gpt-4o-mini':         { input: 0.15, output: 0.60 },
  'gpt-4o':              { input: 2.50, output: 10.00 },
  'claude-haiku-4.5':    { input: 0.80, output: 4.00 },
  'claude-sonnet-4.6':   { input: 3.00, output: 15.00 },
  'gemini-2.0-flash':    { input: 0.10, output: 0.40 },
};

// Static credit cost overrides for tasks where we know the price upfront.
// Otherwise we fall back to balance-delta measurement.
export const TASK_CREDITS_OVERRIDE: Record<string, number> = {
  // Image
  'flux-2-text-to-image':              15,
  'flux-2-image-to-image':             20,
  'gpt/gpt-image-2-text-to-image':     30,
  'gpt/gpt-image-2-image-to-image':    35,
  'google/imagen4-ultra':              40,
  // Image-to-video / animate
  'grok-imagine/image-to-video':       180,
  'bytedance/v1-pro-fast-image-to-video': 200,
  // Text-to-video
  'grok-imagine/text-to-video':        220,
  'bytedance/seedance-1-5-pro':        300,
  'veo3':                              400,
  'veo3_fast':                         200,
};

/** Tier discount on top of base price. OFFICIAL gets 10%, TRUSTED gets 5%. */
function tierDiscount(tier?: MerchantTier | null): number {
  if (tier === MerchantTier.OFFICIAL) return 0.10;
  if (tier === MerchantTier.TRUSTED) return 0.05;
  return 0;
}

/** Round PLS amount up to nice number (e.g. 17.3 → 18). */
function roundPls(n: number): bigint {
  return BigInt(Math.max(1, Math.ceil(n)));
}

export interface PriceResult {
  pricePls: bigint;
  burnPls: bigint;
  costUsd: number;
  marginUsd: number;
}

/** Compute price for a chat completion based on token usage. */
export function priceChatTokens(args: {
  model: string;
  promptTokens: number;
  completionTokens: number;
  tier?: MerchantTier | null;
}): PriceResult {
  const rates = CHAT_PRICE_USD_PER_1M[args.model] ?? CHAT_PRICE_USD_PER_1M['deepseek-chat'];
  const inputUsd = (args.promptTokens / 1_000_000) * rates.input;
  const outputUsd = (args.completionTokens / 1_000_000) * rates.output;
  const costUsd = inputUsd + outputUsd;
  const withMargin = costUsd * (1 + PLATFORM_MARGIN);
  const discounted = withMargin * (1 - tierDiscount(args.tier));
  const pricePls = roundPls(discounted * PLS_PER_USD);
  return {
    pricePls,
    burnPls: BigInt(Math.ceil(Number(pricePls) * BURN_PCT_OF_CHARGE)),
    costUsd,
    marginUsd: discounted - costUsd,
  };
}

/** Compute price for a task based on credits used (or static override). */
export function priceTaskCredits(args: {
  model: string;
  creditsUsed?: number;
  tier?: MerchantTier | null;
}): PriceResult {
  const credits = args.creditsUsed ?? TASK_CREDITS_OVERRIDE[args.model] ?? 50;
  const costUsd = credits * USD_PER_CREDIT;
  const withMargin = costUsd * (1 + PLATFORM_MARGIN);
  const discounted = withMargin * (1 - tierDiscount(args.tier));
  const pricePls = roundPls(discounted * PLS_PER_USD);
  return {
    pricePls,
    burnPls: BigInt(Math.ceil(Number(pricePls) * BURN_PCT_OF_CHARGE)),
    costUsd,
    marginUsd: discounted - costUsd,
  };
}

/** Pre-flight estimate so we can charge the user upfront before async tasks. */
export function estimateTaskPls(model: string, tier?: MerchantTier | null): bigint {
  return priceTaskCredits({ model, tier }).pricePls;
}
