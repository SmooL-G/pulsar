"""Echo bot example. Run: BOT_TOKEN=... python examples/echo.py"""
import os
from pulsar_bot import Bot, Keyboard

bot = Bot(os.environ["BOT_TOKEN"])


@bot.command("start")
async def start(ctx):
    await ctx.reply(
        "👋 Привет! Я эхо-бот. Напишите что угодно, и я повторю.",
        buttons=Keyboard.inline([
            [{"text": "ℹ️ О боте", "data": "about"}],
        ]),
    )


@bot.on_callback("about")
async def about(ctx):
    await ctx.reply("Я простой эхо-бот на pulsar-bot 🚀")


@bot.on_message()
async def echo(ctx):
    if ctx.text and not ctx.text.startswith("/"):
        await ctx.reply(f"Echo: {ctx.text}")


if __name__ == "__main__":
    bot.run()
