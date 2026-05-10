import { env } from '../../config/env.js';

/**
 * Thin client for OpenAI DALL-E 3 image generation, routed through
 * the Pulsar AI relay (because jino.ru is geo-blocked from OpenAI).
 *
 * Synchronous: the upstream call returns the image URL directly, so
 * unlike KIE.AI tasks there's no polling step. Caller can immediately
 * mark the request DONE and post the result to chat.
 */

export class DalleError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'DalleError';
  }
}

export interface DalleResult {
  url: string;
  model: string;
}

export async function generateImageDalle3(args: {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}): Promise<DalleResult> {
  if (!env.AI_RELAY_URL) {
    throw new DalleError('NO_RELAY', 'AI_RELAY_URL not configured — DALL-E requires the relay');
  }
  if (!env.AI_RELAY_TOKEN) {
    throw new DalleError('NO_TOKEN', 'AI_RELAY_TOKEN not configured');
  }
  const url = `${env.AI_RELAY_URL}/image/dalle3`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 60_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Relay-Token': env.AI_RELAY_TOKEN,
      },
      body: JSON.stringify({
        prompt: args.prompt,
        size: args.size ?? '1024x1024',
        quality: args.quality ?? 'standard',
        n: 1,
      }),
    });
    const text = await res.text();
    let body: any;
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
    if (!res.ok) {
      throw new DalleError(
        `HTTP_${res.status}`,
        body?.error || body?.raw || `Relay ${res.status}`,
      );
    }
    if (!body?.url) {
      throw new DalleError('BAD_RESPONSE', 'Relay returned no url');
    }
    return { url: body.url, model: body.model || 'dall-e-3' };
  } finally {
    clearTimeout(t);
  }
}
