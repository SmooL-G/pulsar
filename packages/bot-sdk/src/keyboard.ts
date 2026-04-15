import type { InlineButton, InlineKeyboard } from './types.js';

export class Keyboard {
  private rows: InlineButton[][] = [];

  static inline(buttons: Array<Array<{ text: string; data: string }>>): InlineKeyboard {
    return buttons.map(row => row.map(b => ({ text: b.text, callbackData: b.data })));
  }

  row(...buttons: Array<{ text: string; data: string }>): this {
    this.rows.push(buttons.map(b => ({ text: b.text, callbackData: b.data })));
    return this;
  }

  build(): InlineKeyboard {
    return this.rows;
  }
}
