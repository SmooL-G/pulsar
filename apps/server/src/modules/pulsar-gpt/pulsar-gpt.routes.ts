import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { getCreditBalance } from './kie.client.js';
import {
  runChat,
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
        .filter(([m]) => m.includes('image') || m.includes('flux') || m.includes('imagen'))
        .map(([id, credits]) => ({ id, credits, plsEstimate: estimateTaskPls(id).toString() })),
      animate: Object.entries(TASK_CREDITS_OVERRIDE)
        .filter(([m]) => m.includes('image-to-video') || m === 'grok-imagine/image-to-video')
        .map(([id, credits]) => ({ id, credits, plsEstimate: estimateTaskPls(id).toString() })),
      video: Object.entries(TASK_CREDITS_OVERRIDE)
        .filter(([m]) => m.includes('text-to-video') || m === 'veo3' || m === 'veo3_fast' || m.includes('seedance'))
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
