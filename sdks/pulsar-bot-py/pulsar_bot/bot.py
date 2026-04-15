"""Pulsar Bot — async long-polling bot framework."""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

import httpx

log = logging.getLogger("pulsar_bot")

DEFAULT_API = "https://pulsar-chat.fun/api/v1/bot"

Handler = Callable[["Context"], Awaitable[None]]


class Context:
    """Handler context with reply helpers."""

    def __init__(self, bot: "Bot", update: Dict[str, Any]) -> None:
        self.bot = bot
        self.update = update
        payload = update.get("payload", {}) or {}
        self._message = payload.get("message")
        self._callback = payload.get("callback_query")

    @property
    def message(self) -> Optional[Dict[str, Any]]:
        return self._message

    @property
    def callback_query(self) -> Optional[Dict[str, Any]]:
        return self._callback

    @property
    def text(self) -> Optional[str]:
        return self._message.get("text") if self._message else None

    @property
    def from_user(self) -> Optional[Dict[str, Any]]:
        if self._message:
            return self._message.get("from")
        if self._callback:
            return self._callback.get("from")
        return None

    @property
    def chat_id(self) -> Optional[str]:
        if self._message:
            return self._message.get("chatId")
        if self._callback:
            return (self._callback.get("message") or {}).get("chat", {}).get("id")
        return None

    async def reply(
        self,
        text: str,
        buttons: Optional[List[List[Dict[str, str]]]] = None,
        reply_to_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.chat_id:
            raise RuntimeError("Context has no chat — cannot reply")
        return await self.bot.send_message(
            self.chat_id, text, buttons=buttons, reply_to_id=reply_to_id
        )

    async def answer_callback(self, text: Optional[str] = None) -> Dict[str, Any]:
        if not self._callback:
            return {"ok": True}
        return await self.bot.answer_callback(self._callback["id"], text)


class Bot:
    """Pulsar bot with long-polling loop and decorator-based handlers."""

    def __init__(
        self,
        token: str,
        api_url: str = DEFAULT_API,
        poll_timeout: int = 30,
        poll_limit: int = 100,
    ) -> None:
        if not token:
            raise ValueError("Bot token is required")
        self.token = token
        self.api_url = api_url
        self.poll_timeout = poll_timeout
        self.poll_limit = poll_limit
        self._running = False
        self._offset = "0"
        self._client: Optional[httpx.AsyncClient] = None

        self._command_handlers: Dict[str, Handler] = {}
        self._message_handlers: List[Handler] = []
        self._callback_handlers: Dict[str, Handler] = {}
        self._callback_prefix: List[Tuple[str, Handler]] = []
        self._callback_any: List[Handler] = []
        self._error_handler: Optional[Callable[[BaseException, Optional[Context]], Awaitable[None]]] = None

    # ——— Decorator registration ———

    def command(self, name: str) -> Callable[[Handler], Handler]:
        def decorator(func: Handler) -> Handler:
            self._command_handlers[name.lstrip("/").lower()] = func
            return func
        return decorator

    def on_message(self) -> Callable[[Handler], Handler]:
        def decorator(func: Handler) -> Handler:
            self._message_handlers.append(func)
            return func
        return decorator

    def on_callback(self, data: str) -> Callable[[Handler], Handler]:
        def decorator(func: Handler) -> Handler:
            if data == "*":
                self._callback_any.append(func)
            elif data.endswith("*"):
                self._callback_prefix.append((data[:-1], func))
            else:
                self._callback_handlers[data] = func
            return func
        return decorator

    def on_error(self, func: Callable[[BaseException, Optional[Context]], Awaitable[None]]) -> None:
        self._error_handler = func

    # ——— HTTP helpers ———

    async def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.api_url,
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=httpx.Timeout(self.poll_timeout + 10),
            )
        return self._client

    async def _post(self, path: str, json: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        http = await self._http()
        r = await http.post(path, json=json)
        r.raise_for_status()
        return r.json()

    async def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        http = await self._http()
        r = await http.get(path, params=params)
        r.raise_for_status()
        return r.json()

    # ——— API methods ———

    async def get_me(self) -> Dict[str, Any]:
        return await self._get("/me")

    async def send_message(
        self,
        chat_id: str,
        text: str,
        buttons: Optional[List[List[Dict[str, str]]]] = None,
        reply_to_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {"chatId": chat_id, "text": text}
        if buttons:
            body["buttons"] = buttons
        if reply_to_id:
            body["replyToId"] = reply_to_id
        return await self._post("/sendMessage", body)

    async def delete_message(self, chat_id: str, message_id: str) -> Dict[str, Any]:
        return await self._post("/deleteMessage", {"chatId": chat_id, "messageId": message_id})

    async def kick_member(self, chat_id: str, user_id: str) -> Dict[str, Any]:
        return await self._post("/kickMember", {"chatId": chat_id, "userId": user_id})

    async def answer_callback(self, callback_query_id: str, text: Optional[str] = None) -> Dict[str, Any]:
        return await self._post("/answerCallback", {"callbackQueryId": callback_query_id, "text": text})

    async def set_webhook(self, url: Optional[str], secret: Optional[str] = None) -> Dict[str, Any]:
        return await self._post("/setWebhook", {"url": url, "secret": secret})

    async def set_commands(self, commands: List[Dict[str, str]]) -> Dict[str, Any]:
        return await self._post("/setCommands", {"commands": commands})

    async def get_chats(self) -> Dict[str, Any]:
        return await self._get("/getChats")

    async def leave_chat(self, chat_id: str) -> Dict[str, Any]:
        return await self._post("/leaveChat", {"chatId": chat_id})

    # ——— Long polling ———

    async def start(self) -> None:
        """Run long-poll loop until stop() is called."""
        if self._running:
            return
        self._running = True

        try:
            await self.set_webhook(None)
        except Exception:
            pass

        try:
            me = await self.get_me()
            log.info("[Pulsar Bot] Started as @%s", me.get("username"))
        except Exception:
            pass

        while self._running:
            try:
                data = await self._get(
                    "/updates",
                    params={
                        "offset": self._offset,
                        "timeout": self.poll_timeout,
                        "limit": self.poll_limit,
                    },
                )
                for update in data.get("result") or []:
                    self._offset = str(int(update["id"]) + 1)
                    await self._dispatch(update)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                if self._error_handler:
                    try:
                        await self._error_handler(e, None)
                    except Exception:
                        pass
                else:
                    log.exception("[Pulsar Bot] poll error")
                await asyncio.sleep(3)

        if self._client:
            await self._client.aclose()
            self._client = None

    def stop(self) -> None:
        self._running = False

    def run(self) -> None:
        """Blocking entrypoint — runs asyncio event loop."""
        try:
            asyncio.run(self.start())
        except KeyboardInterrupt:
            self.stop()

    async def _dispatch(self, update: Dict[str, Any]) -> None:
        ctx = Context(self, update)
        try:
            if update.get("type") == "callback_query" and update.get("payload", {}).get("callback_query"):
                data = update["payload"]["callback_query"].get("data", "")
                if data in self._callback_handlers:
                    return await self._callback_handlers[data](ctx)
                for prefix, handler in self._callback_prefix:
                    if data.startswith(prefix):
                        return await handler(ctx)
                for h in self._callback_any:
                    await h(ctx)
                return

            text = (ctx.message or {}).get("text") or ""
            if text.startswith("/"):
                cmd = text[1:].split()[0].split("@")[0].lower()
                handler = self._command_handlers.get(cmd)
                if handler:
                    return await handler(ctx)

            for h in self._message_handlers:
                await h(ctx)
        except Exception as e:
            if self._error_handler:
                try:
                    await self._error_handler(e, ctx)
                except Exception:
                    pass
            else:
                log.exception("[Pulsar Bot] handler error")
