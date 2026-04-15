export interface BotOptions {
  token: string;
  apiUrl?: string;
  pollTimeout?: number;
  pollLimit?: number;
}

export interface User {
  id: string;
  username?: string;
  displayName?: string | null;
}

export interface Chat {
  id: string;
  type?: 'DIRECT' | 'GROUP' | 'CHANNEL';
  name?: string | null;
}

export interface IncomingMessage {
  id: string;
  chatId: string;
  from: User | null;
  text: string | null;
  date: string;
  replyToId: string | null;
}

export interface CallbackQuery {
  id: string;
  from: { id: string };
  message: { id: string; chat: { id: string } };
  data: string;
}

export interface Update {
  id: string;
  type: 'message' | 'command' | 'callback_query';
  payload: {
    type?: string;
    message?: IncomingMessage;
    callback_query?: CallbackQuery;
  };
}

export interface InlineButton {
  text: string;
  callbackData: string;
}

export type InlineKeyboard = InlineButton[][];

export interface SendMessageOptions {
  replyToId?: string;
  buttons?: InlineKeyboard;
}

export interface BotCommand {
  command: string;
  description: string;
}
