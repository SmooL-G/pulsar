import type { Bot } from './bot.js';
import type { IncomingMessage, CallbackQuery, Update, SendMessageOptions } from './types.js';

export class Context {
  constructor(
    public readonly bot: Bot,
    public readonly update: Update,
  ) {}

  get message(): IncomingMessage | null {
    return this.update.payload.message || null;
  }

  get callbackQuery(): CallbackQuery | null {
    return this.update.payload.callback_query || null;
  }

  get text(): string | null {
    return this.message?.text || null;
  }

  get from() {
    return this.message?.from || this.callbackQuery?.from || null;
  }

  get chat() {
    if (this.message) return { id: this.message.chatId };
    if (this.callbackQuery) return this.callbackQuery.message.chat;
    return null;
  }

  get chatId(): string | null {
    return this.chat?.id || null;
  }

  async reply(text: string, options?: SendMessageOptions) {
    if (!this.chatId) throw new Error('Context has no chat — cannot reply');
    return this.bot.sendMessage(this.chatId, text, options);
  }

  async answerCallback(text?: string) {
    if (!this.callbackQuery) return;
    return this.bot.answerCallback(this.callbackQuery.id, text);
  }
}
