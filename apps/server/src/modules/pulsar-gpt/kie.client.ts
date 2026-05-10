import { env } from '../../config/env.js';

/**
 * Thin client for KIE.AI — multi-model AI marketplace.
 *
 *   chatComplete()    → OpenAI-compatible /chat/completions, sync
 *   createTask()      → async job for image/video/audio generation
 *   getTaskInfo()     → poll task status
 *   getCreditBalance()→ remaining credits on our account
 *
 * KIE responses are wrapped in `{ code, msg, data }` envelopes for
 * task endpoints, but the chat endpoint returns the raw OpenAI shape.
 * We normalize both into typed return values.
 */

const TIMEOUT_MS = 30_000;

export class KieError extends Error {
  constructor(public code: string, message: string, public httpStatus?: number) {
    super(message);
    this.name = 'KieError';
  }
}

function authHeader(): Record<string, string> {
  // When the relay is in use, the relay rewrites Authorization with its
  // own KIE key — but we still need to satisfy our local validation that
  // a key is configured. The relay is the source of truth for the actual
  // key sent upstream. We always also include X-Relay-Token when set so
  // the relay accepts the request.
  const usingRelay = !!env.AI_RELAY_TOKEN;
  if (!usingRelay && !env.KIE_API_KEY) {
    throw new KieError('KIE_API_KEY_MISSING', 'KIE_API_KEY env var not configured');
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.KIE_API_KEY || 'relay'}`,
    'Content-Type': 'application/json',
  };
  if (env.AI_RELAY_TOKEN) headers['X-Relay-Token'] = env.AI_RELAY_TOKEN;
  return headers;
}

async function request(url: string, init?: RequestInit): Promise<any> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    const text = await res.text();
    let body: any;
    try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
    if (!res.ok) {
      throw new KieError(
        `HTTP_${res.status}`,
        body?.msg || body?.error?.message || `Upstream ${res.status}`,
        res.status,
      );
    }
    return body;
  } finally {
    clearTimeout(t);
  }
}

// ─── Chat (OpenAI-compatible, sync) ─────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export async function chatComplete(args: {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<ChatResponse> {
  const url = `${env.KIE_API_BASE_CHAT}/chat/completions`;
  const body = await request(url, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      max_tokens: args.maxTokens ?? 1024,
    }),
  });
  const choice = body?.choices?.[0]?.message?.content;
  if (typeof choice !== 'string') {
    throw new KieError('BAD_CHAT_RESPONSE', 'Empty choices in response');
  }
  return {
    text: choice,
    model: body.model ?? args.model,
    promptTokens: body?.usage?.prompt_tokens ?? 0,
    completionTokens: body?.usage?.completion_tokens ?? 0,
    totalTokens: body?.usage?.total_tokens ?? 0,
  };
}

// ─── Async tasks (image, video, audio) ──────────────────

export interface CreateTaskResult {
  taskId: string;
}

export async function createTask(args: {
  model: string;
  input: Record<string, unknown>;
  callBackUrl?: string;
}): Promise<CreateTaskResult> {
  const url = `${env.KIE_API_BASE_TASKS}/jobs/createTask`;
  const body = await request(url, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({
      model: args.model,
      input: args.input,
      ...(args.callBackUrl ? { callBackUrl: args.callBackUrl } : {}),
    }),
  });
  if (body?.code !== 200 || !body?.data?.taskId) {
    throw new KieError(
      `TASK_CREATE_${body?.code ?? 'UNKNOWN'}`,
      body?.msg || 'Failed to create task',
    );
  }
  return { taskId: String(body.data.taskId) };
}

export type TaskState = 'pending' | 'running' | 'success' | 'failed';

export interface TaskInfo {
  taskId: string;
  state: TaskState;
  resultUrls: string[];
  errorMessage?: string;
  /** Raw response.data for debugging or model-specific fields. */
  raw: any;
}

export async function getTaskInfo(taskId: string): Promise<TaskInfo> {
  const url = `${env.KIE_API_BASE_TASKS}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;
  const body = await request(url, { headers: authHeader() });
  if (body?.code !== 200) {
    throw new KieError(
      `TASK_INFO_${body?.code ?? 'UNKNOWN'}`,
      body?.msg || 'Failed to fetch task info',
    );
  }
  const d = body.data ?? {};
  // KIE uses different state field names across models — normalize.
  const rawState = String(d.state ?? d.status ?? '').toLowerCase();
  let state: TaskState = 'pending';
  if (['success', 'succeed', 'succeeded', 'completed', 'done'].includes(rawState)) state = 'success';
  else if (['fail', 'failed', 'error'].includes(rawState)) state = 'failed';
  else if (['running', 'in_progress', 'processing'].includes(rawState)) state = 'running';

  // Result URLs likewise vary across model families:
  //   - direct array      : d.resultUrls
  //   - direct single     : d.resultUrl
  //   - nested in response: d.response.urls / d.response.url / d.response.resultUrls
  //   - JSON-encoded      : d.resultJson (string) → parse → resultUrls
  //                         ↑ Kling uses this; learned from working ref impl
  let resultUrls: string[] = [];
  if (Array.isArray(d.resultUrls)) resultUrls = d.resultUrls;
  else if (typeof d.resultUrl === 'string') resultUrls = [d.resultUrl];
  else if (Array.isArray(d?.response?.urls)) resultUrls = d.response.urls;
  else if (typeof d?.response?.url === 'string') resultUrls = [d.response.url];
  else if (Array.isArray(d?.response?.resultUrls)) resultUrls = d.response.resultUrls;
  else if (typeof d?.response?.resultUrls === 'string') {
    try { resultUrls = JSON.parse(d.response.resultUrls); } catch { /* ignore */ }
  } else if (typeof d.resultJson === 'string' && d.resultJson) {
    try {
      const parsed = JSON.parse(d.resultJson);
      if (Array.isArray(parsed?.resultUrls)) resultUrls = parsed.resultUrls;
      else if (typeof parsed?.resultUrl === 'string') resultUrls = [parsed.resultUrl];
    } catch { /* ignore — log via outer error path */ }
  }

  // KIE uses several error field names across models — try them all
  // before falling back to the raw payload so the user sees something
  // actionable.
  const errorMessage =
    d.errorMessage ||
    d.failMsg ||
    d.failureReason ||
    d.error ||
    d.msg ||
    d?.response?.errorMessage ||
    d?.response?.error ||
    (state === 'failed' ? `Upstream rejected: ${JSON.stringify(d).slice(0, 300)}` : undefined);

  return {
    taskId,
    state,
    resultUrls,
    errorMessage,
    raw: d,
  };
}

// ─── Veo (Google Veo3) — separate endpoint family ───────
//
// Veo lives at /api/v1/veo/* with a flat payload (NOT wrapped in
// `input`) and a different polling response shape (`successFlag`
// instead of `state`, `response.resultUrls` instead of `resultJson`).
// Model IDs are bare: "veo3" (1080p) or "veo3_fast" (720p).

export interface CreateVeoArgs {
  prompt: string;
  model: 'veo3' | 'veo3_fast';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  /** image-to-video Veo flow — pass [imageUrl]; omit for text-to-video. */
  imageUrls?: string[];
}

export async function createVeoTask(args: CreateVeoArgs): Promise<CreateTaskResult> {
  const url = `${env.KIE_API_BASE_TASKS}/veo/generate`;
  const isImageDriven = (args.imageUrls?.length ?? 0) > 0;
  const body = await request(url, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({
      prompt: args.prompt,
      model: args.model,
      aspectRatio: args.aspectRatio ?? '16:9',
      enableTranslation: true,
      enableFallback: true,
      generationType: isImageDriven ? 'FIRST_AND_LAST_FRAMES_2_VIDEO' : 'TEXT_2_VIDEO',
      ...(isImageDriven && { imageUrls: args.imageUrls }),
    }),
  });
  if (body?.code !== 200 || !body?.data?.taskId) {
    throw new KieError(
      `VEO_CREATE_${body?.code ?? 'UNKNOWN'}`,
      body?.msg || 'Failed to create Veo task',
    );
  }
  return { taskId: String(body.data.taskId) };
}

/** Poll a Veo task. Veo uses a different status field (`successFlag`)
 *  and a different result location (`response.resultUrls`) than the
 *  generic /jobs endpoints. We translate to the same `TaskInfo` shape
 *  so callers don't need to branch. */
export async function getVeoTaskInfo(taskId: string): Promise<TaskInfo> {
  const url = `${env.KIE_API_BASE_TASKS}/veo/record-info?taskId=${encodeURIComponent(taskId)}`;
  const body = await request(url, { headers: authHeader() });
  if (body?.code !== 200) {
    throw new KieError(`VEO_INFO_${body?.code ?? 'UNKNOWN'}`, body?.msg || 'Failed to fetch Veo task info');
  }
  const d = body.data ?? {};
  const flag = d.successFlag;

  let state: TaskState = 'pending';
  if (flag === 1) state = 'success';
  else if (flag === 2 || flag === 3) state = 'failed';
  else state = 'running';

  let resultUrls: string[] = [];
  const respUrls = d?.response?.resultUrls;
  if (Array.isArray(respUrls)) resultUrls = respUrls;
  else if (typeof respUrls === 'string') {
    try { resultUrls = JSON.parse(respUrls); } catch { /* ignore */ }
  }

  return {
    taskId,
    state,
    resultUrls,
    errorMessage: d.errorMessage || d.error || undefined,
    raw: d,
  };
}

// ─── Account ────────────────────────────────────────────

export async function getCreditBalance(): Promise<number> {
  const url = `${env.KIE_API_BASE_TASKS}/chat/credit`;
  const body = await request(url, { headers: authHeader() });
  if (body?.code !== 200) {
    throw new KieError(`CREDIT_${body?.code ?? 'UNKNOWN'}`, body?.msg || 'Credit fetch failed');
  }
  return Number(body?.data ?? 0);
}
