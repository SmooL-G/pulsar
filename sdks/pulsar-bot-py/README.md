# pulsar-bot

Официальный Python SDK для ботов мессенджера [Pulsar](https://pulsar-chat.fun). Стиль — как `python-telegram-bot`/`aiogram`, async из коробки.

## Установка

```bash
pip install pulsar-bot
```

Требуется **Python 3.9+**.

## Быстрый старт

1. Создайте бота через [@pulsarbot](https://pulsar-chat.fun) → `/newbot` → получите токен.
2. Напишите бота:

```python
from pulsar_bot import Bot, Keyboard

bot = Bot("YOUR_TOKEN")

@bot.command("start")
async def start(ctx):
    await ctx.reply(
        "Привет! Выбери опцию:",
        buttons=Keyboard.inline([
            [{"text": "✅ Да", "data": "yes"}, {"text": "❌ Нет", "data": "no"}],
        ]),
    )

@bot.on_callback("yes")
async def on_yes(ctx):
    await ctx.reply("Отлично!")

@bot.on_callback("no")
async def on_no(ctx):
    await ctx.reply("Как скажете.")

@bot.on_message()
async def echo(ctx):
    if ctx.text and not ctx.text.startswith("/"):
        await ctx.reply(f"Echo: {ctx.text}")

if __name__ == "__main__":
    bot.run()
```

3. `python bot.py` — готово.

## API

### Декораторы
```python
@bot.command("start")     # /start
@bot.on_message()         # любое текстовое сообщение
@bot.on_callback("yes")   # точное совпадение callback_data
@bot.on_callback("item_*") # префикс (item_1, item_2, …)
@bot.on_callback("*")     # fallback для всех callback
```

### Context
- `ctx.text` — текст сообщения
- `ctx.from_user` — отправитель `{"id": ...}`
- `ctx.chat_id` — ID чата
- `await ctx.reply(text, buttons=..., reply_to_id=...)`
- `await ctx.answer_callback(text)`

### Методы бота
```python
await bot.send_message(chat_id, text, buttons=..., reply_to_id=...)
await bot.delete_message(chat_id, message_id)
await bot.kick_member(chat_id, user_id)
await bot.set_commands([{"command": "start", "description": "Начать"}])
await bot.set_webhook("https://mybot.com/hook", secret="...")
await bot.get_chats()
await bot.leave_chat(chat_id)
```

### Keyboard
```python
Keyboard.inline([
    [{"text": "Да", "data": "yes"}, {"text": "Нет", "data": "no"}],
    [{"text": "Отмена", "data": "cancel"}],
])
# или builder-style:
Keyboard().row({"text": "Да", "data": "yes"}, {"text": "Нет", "data": "no"}) \
          .row({"text": "Отмена", "data": "cancel"}).build()
```

## Документация

Полная документация API: https://pulsar-chat.fun/developers
