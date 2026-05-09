import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { getCreditBalance } from './kie.client.js';
import {
  runChat,
  startTask,
  getRequest,
  getUserSettings,
  updateUserSettings,
  listHistory,
  PulsarGptError,
} from './pulsar-gpt.service.js';
import { CHAT_PRICE_USD_PER_1M, TASK_CREDITS_OVERRIDE, estimateTaskPls } from './pricing.js';

function handle<T>(reply: any, fn: () => Promise<T>) {
  return fn().catch((err: any) => {
    if (err instanceof PulsarGptError) {
      return reply.status(400).send({ error: err.code, message: err.message });
    }
    console.error('[pulsar-gpt]', err);
    return reply.status(500).send({ error: 'INTERNAL', message: err?.message || 'Server error' });
  });
}

export async function pulsarGptRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // GET /pulsar-gpt/models — list of supported models + estimated PLS
  // price per category, used by the settings UI.
  app.get('/models', async () => {
    return {
      chat: Object.keys(CHAT_PRICE_USD_PER_1M).map((m) => ({
        id: m,
        usdPer1MIn: CHAT_PRICE_USD_PER_1M[m].input,
        usdPer1MOut: CHAT_PRICE_USD_PER_1M[m].output,
      })),
      image: Object.entries(TASK_CREDITS_OVERRIDE)
        .filter(([m]) => m.includes('text-to-image') || m.includes('image-to-image'))
        .map(([id, credits]) => ({ id, credits, plsEstimate: estimateTaskPls(id).toString() })),
      animate: Object.entries(TASK_CREDITS_OVERRIDE)
        .filter(([m]) => m.includes('image-to-video') || m.includes('seedance'))
        .map(([id, credits]) => ({ id, credits, plsEstimate: estimateTaskPls(id).toString() })),
      video: Object.entries(TASK_CREDITS_OVERRIDE)
        .filter(([m]) => m.includes('text-to-video'))
        .map(([id, credits]) => ({ id, credits, plsEstimate: estimateTaskPls(id).toString() })),
    };
  });

  // GET /pulsar-gpt/settings — user's current model picks
  app.get('/settings', async (request) => {
    const settings = await getUserSettings(request.user!.userId);
    return { settings };
  });

  // PATCH /pulsar-gpt/settings
  app.patch<{
    Body: Partial<{ chatModel: string; imageModel: string; animateModel: string; videoModel: string }>;
  }>('/settings', async (request) => {
    const settings = await updateUserSettings(request.user!.userId, request.body || {});
    return { settings };
  });

  // GET /pulsar-gpt/history — last N requests
  app.get<{ Querystring: { limit?: string } }>('/history', async (request) => {
    const limit = request.query.limit ? Math.max(1, Math.min(100, parseInt(request.query.limit, 10))) : 50;
    return { items: await listHistory(request.user!.userId, limit) };
  });

  // POST /pulsar-gpt/chat — run a chat completion
  app.post<{
    Body: {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      model?: string;
      maxTokens?: number;
    };
  }>('/chat', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      const settings = await getUserSettings(userId);
      const model = request.body.model || settings.chatModel;
      if (!Array.isArray(request.body.messages) || request.body.messages.length === 0) {
        throw new PulsarGptError('NO_MESSAGES', 'messages array required');
      }
      const result = await runChat({
        userId,
        model,
        messages: request.body.messages,
        maxTokens: request.body.maxTokens,
      });
      return result;
    }),
  );

  // POST /pulsar-gpt/image — generate image (async). Returns requestId
  // immediately; client polls GET /requests/:id to know when it's done.
  app.post<{ Body: { prompt: string; model?: string; size?: string } }>(
    '/image',
    async (request, reply) => handle(reply, async () => {
      const userId = request.user!.userId;
      const settings = await getUserSettings(userId);
      const model = request.body.model || settings.imageModel;
      if (!request.body.prompt || request.body.prompt.trim().length < 2) {
        throw new PulsarGptError('NO_PROMPT', 'prompt required');
      }
      return startTask({
        userId,
        type: 'IMAGE',
        model,
        prompt: request.body.prompt,
        extraInput: request.body.size ? { size: request.body.size } : undefined,
      });
    }),
  );

  // POST /pulsar-gpt/animate — image-to-video. Caller uploads the
  // image first (POST /upload/file) and passes its public URL here.
  app.post<{ Body: { imageUrl: string; prompt?: string; model?: string } }>(
    '/animate',
    async (request, reply) => handle(reply, async () => {
      const userId = request.user!.userId;
      const settings = await getUserSettings(userId);
      const model = request.body.model || settings.animateModel;
      if (!request.body.imageUrl) {
        throw new PulsarGptError('NO_IMAGE', 'imageUrl required');
      }
      return startTask({
        userId,
        type: 'ANIMATE',
        model,
        prompt: request.body.prompt,
        inputUrl: request.body.imageUrl,
      });
    }),
  );

  // POST /pulsar-gpt/video — text-to-video
  app.post<{ Body: { prompt: string; model?: string; duration?: number; hd?: boolean } }>(
    '/video',
    async (request, reply) => handle(reply, async () => {
      const userId = request.user!.userId;
      const settings = await getUserSettings(userId);
      const model = request.body.model || settings.videoModel;
      if (!request.body.prompt || request.body.prompt.trim().length < 2) {
        throw new PulsarGptError('NO_PROMPT', 'prompt required');
      }
      const extra: Record<string, unknown> = {};
      if (request.body.duration) extra.duration = request.body.duration;
      if (request.body.hd) extra.hd = true;
      return startTask({
        userId,
        type: 'VIDEO',
        model,
        prompt: request.body.prompt,
        extraInput: Object.keys(extra).length ? extra : undefined,
      });
    }),
  );

  // GET /pulsar-gpt/requests/:id — poll status of an async task
  app.get<{ Params: { id: string } }>('/requests/:id', async (request, reply) =>
    handle(reply, async () => {
      const row = await getRequest(request.params.id, request.user!.userId);
      if (!row) return reply.status(404).send({ error: 'NOT_FOUND' });
      return { request: row };
    }),
  );

  // GET /pulsar-gpt/admin/balance — KIE credit balance (admin only)
  app.register(async (admin) => {
    admin.addHook('preHandler', async (request, reply) => {
      if (request.user?.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }
    });
    admin.get('/admin/balance', async () => {
      try {
        const credits = await getCreditBalance();
        return { credits };
      } catch (err: any) {
        return { error: err?.message ?? 'failed' };
      }
    });
  });
}
