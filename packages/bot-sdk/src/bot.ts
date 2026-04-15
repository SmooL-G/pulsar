import { Context } from './context.js';
import type {
  BotOptions,
  Update,
  SendMessageOptions,
  BotCommand,
} from './types.js';

type Handler = (ctx: Context) => void | Promise<void>;

const DEFAULT_API = 'https://pulsar-chat.fun/api/v1/bot';

export class Bot {
  private token: string;
  private apiUrl: string;
  private pollTimeout: number;
  private pollLimit: number;
  private running = false;
  private offset = '0';

  private commandHandlers = new Map<string, Handler>();
  private messageHandlers: Handler[] = [];
  private callbackHandlers = new Map<string, Handler>();
  private callbackPrefixHandlers: Array<{ prefix: string; handler: Handler }> = [];
  private anyCallbackHandlers: Handler[] = [];
  private errorHandler: ((err: unknown, ctx?: Context) => void) | null = null;

  constructor(tokenOrOptions: string | BotOptions) {
    const opts = typeof tokenOrOptions === 'string' ? { token: tokenOrOptions } : tokenOrOptions;
    if (!opts.token) throw new Error('Bot token is required');
    this.token = opts.token;
    this.apiUrl = opts.apiUrl || DEFAULT_API;
    this.pollTimeout = opts.pollTimeout ?? 30;
    this.pollLimit = opts.pollLimit ?? 100;
  }

  /** Register a /command handler. */
  command(name: string, handler: Handler): this {
    this.commandHandlers.set(name.replace(/^\//, '').toLowerCase(), handler);
    return this;
  }

  /** Register a handler for all plain-text messages (non-commands). */
  onMessage(handler: Handler): this {
    this.messageHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for a specific callback data.
   * Supports exact match or prefix-match if key ends with '*'.
   */
  onCallback(data: string, handler: Handler): this {
    if (data === '*') {
      this.anyCallbackHandlers.push(handler);
    } else if (data.endsWith('*')) {
      this.callbackPrefixHandlers.push({ prefix: data.slice(0, -1), handler });
    } else {
      this.callbackHandlers.set(data, handler);
    }
    return this;
  }

  onError(handler: (err: unknown, ctx?: Context) => void): this {
    this.errorHandler = handler;
    return this;
  }

  private headers(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T = any>(path: string, body?: unknown, method: 'GET' | 'POST' = 'POST'): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`[${res.status}] ${(data as any)?.error || res.statusText}`);
    }
    return data as T;
  }

  // ——— API methods ———

  async getMe() {
    return this.request('/me', undefined, 'GET');
  }

  async sendMessage(chatId: string, text: string, options?: SendMessageOptions) {
    return this.request('/sendMessage', { chatId, text, ...options });
  }

  async deleteMessage(chatId: string, messageId: string) {
    return this.request('/deleteMessage', { chatId, messageId });
  }

  async kickMember(chatId: string, userId: string) {
    return this.request('/kickMember', { chatId, userId });
  }

  async answerCallback(callbackQueryId: string, text?: string) {
    return this.request('/answerCallback', { callbackQueryId, text });
  }

  async setWebhook(url: string | null, secret?: string) {
    return this.request('/setWebhook', { url, secret });
  }

  async getChats() {
    return this.request('/getChats', undefined, 'GET');
  }

  async setCommands(commands: BotCommand[]) {
    return this.request('/setCommands', { commands });
  }

  async leaveChat(chatId: string) {
    return this.request('/leaveChat', { chatId });
  }

  // ——— Long polling ———

  /** Start long-polling loop. Resolves only when stop() is called. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Clear any stale webhook so long polling works
    await this.setWebhook(null).catch(() => {});

    const me = await this.getMe().catch(() => null);
    if (me) {
      console.log(`[Pulsar Bot] Started as @${(me as any).username}`);
    }

    while (this.running) {
      try {
        const query = new URLSearchParams({
          offset: this.offset,
          timeout: String(this.pollTimeout),
          limit: String(this.pollLimit),
        });
        const res = await fetch(`${this.apiUrl}/updates?${query}`, {
          headers: { Authorization: `Bearer ${this.token}` },
        });
        if (!res.ok) {
          await this.sleep(2000);
          continue;
        }
        const data = await res.json() as { result?: Update[] };
        const updates = data.result || [];
        for (const update of updates) {
          this.offset = String(BigInt(update.id) + 1n);
          await this.dispatch(update);
        }
      } catch (err) {
        if (this.errorHandler) this.errorHandler(err);
        else console.error('[Pulsar Bot] poll error:', err);
        await this.sleep(3000);
      }
    }
  }

  stop() {
    this.running = false;
  }

  private async dispatch(update: Update) {
    const ctx = new Context(this, update);
    try {
      if (update.type === 'callback_query' && update.payload.callback_query) {
        const data = update.payload.callback_query.data;
        const exact = this.callbackHandlers.get(data);
        if (exact) return await exact(ctx);
        for (const { prefix, handler } of this.callbackPrefixHandlers) {
          if (data.startsWith(prefix)) return await handler(ctx);
        }
        for (const h of this.anyCallbackHandlers) await h(ctx);
        return;
      }

      const text = update.payload.message?.text || '';
      if (text.startsWith('/')) {
        const cmd = text.slice(1).split(/[\s@]/)[0].toLowerCase();
        const handler = this.commandHandlers.get(cmd);
        if (handler) return await handler(ctx);
      }

      for (const h of this.messageHandlers) await h(ctx);
    } catch (err) {
      if (this.errorHandler) this.errorHandler(err, ctx);
      else console.error('[Pulsar Bot] handler error:', err);
    }
  }

  private sleep(ms: number) {
    return new Promise<void>(r => setTimeout(r, ms));
  }
}
