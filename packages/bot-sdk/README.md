# @pulsar-chat/bot-sdk

Официальный SDK для создания ботов в мессенджере [Pulsar](https://pulsar-chat.fun). Написан в стиле Telegram Bot API — если у вас был опыт с `telegraf` или `node-telegram-bot-api`, вы сразу поймёте.

## Установка

```bash
npm install @pulsar-chat/bot-sdk
```

Требуется **Node.js 18+** (используется встроенный `fetch`).

## Быстрый старт

1. Создайте бота через [@pulsarbot](https://pulsar-chat.fun) — команда `/newbot`, получите токен.
2. Напишите бота:

```ts
import { Bot, Keyboard } from '@pulsar-chat/bot-sdk';

const bot = new Bot('YOUR_TOKEN');

bot.command('start', (ctx) =>
  ctx.reply('Привет! Выбери опцию:', {
    buttons: Keyboard.inline([
      [{ text: '✅ Да', data: 'yes' }, { text: '❌ Нет', data: 'no' }],
    ]),
  }),
);

bot.onCallback('yes', (ctx) => ctx.reply('Отлично!'));
bot.onCallback('no',  (ctx) => ctx.reply('Как скажете.'));

bot.onMessage((ctx) => ctx.reply(`Echo: ${ctx.text}`));

bot.start();
```

3. Запустите `ts-node bot.ts` или `node bot.js` — готово.

## API

### `new Bot(token | options)`
- `token` — API-токен бота
- `options.apiUrl` — базовый URL (по умолчанию `https://pulsar-chat.fun/api/v1/bot`)
- `options.pollTimeout` — long-poll таймаут в секундах (по умолчанию 30)

### Обработчики
```ts
bot.command('start', handler);       // /start
bot.onMessage(handler);              // любое текстовое сообщение
bot.onCallback('yes', handler);      // точное совпадение callback_data
bot.onCallback('item_*', handler);   // префикс-матчинг: item_1, item_42, ...
bot.onCallback('*', handler);        // любой callback (fallback)
bot.onError((err, ctx) => { ... });
```

### Context
Каждый handler получает `ctx`:
- `ctx.text` — текст сообщения
- `ctx.from` — отправитель `{ id }`
- `ctx.chatId` — ID чата
- `ctx.reply(text, { buttons?, replyToId? })`
- `ctx.answerCallback(text?)`

### Методы API
```ts
await bot.sendMessage(chatId, text, { buttons, replyToId });
await bot.deleteMessage(chatId, messageId);
await bot.kickMember(chatId, userId);
await bot.setCommands([{ command: 'start', description: 'Начать' }]);
await bot.setWebhook('https://mybot.example.com/hook', 'secret');
await bot.getChats();
await bot.leaveChat(chatId);
```

### Keyboard
```ts
Keyboard.inline([
  [{ text: 'Да', data: 'yes' }, { text: 'Нет', data: 'no' }],
  [{ text: 'Отмена', data: 'cancel' }],
])
// или builder-style:
new Keyboard()
  .row({ text: 'Да', data: 'yes' }, { text: 'Нет', data: 'no' })
  .row({ text: 'Отмена', data: 'cancel' })
  .build();
```

## Webhook-режим

Если нужен webhook вместо long polling:

```ts
await bot.setWebhook('https://mybot.example.com/hook');
// В вашем Express-сервере:
app.post('/hook', async (req, res) => {
  const update = req.body;
  // вручную обработать update
  res.json({ ok: true });
});
```

Но для большинства случаев long polling проще — работает с любого ноутбука без публичного URL.

## Документация

Полная документация API: https://pulsar-chat.fun/developers
