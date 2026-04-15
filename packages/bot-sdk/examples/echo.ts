import { Bot, Keyboard } from '@pulsar-chat/bot-sdk';

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command('start', (ctx) =>
  ctx.reply('👋 Привет! Я эхо-бот. Напишите что угодно, и я повторю.', {
    buttons: Keyboard.inline([
      [{ text: 'ℹ️ О боте', data: 'about' }],
    ]),
  }),
);

bot.onMessage((ctx) => {
  if (!ctx.text || ctx.text.startsWith('/')) return;
  ctx.reply(`Echo: ${ctx.text}`);
});

bot.onCallback('about', (ctx) => ctx.reply('Я простой эхо-бот на @pulsar-chat/bot-sdk 🚀'));

bot.start();
