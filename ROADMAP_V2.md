# Pulsar — Roadmap v2: Decentralization, NFT, Balance

## Context

Pulsar — крипто-мессенджер на Solana. Платформа интегрирована с блокчейном: депозиты SOL → PLS, верификация транзакций on-chain, криптографическая подпись сообщений, E2E шифрование, NFT-аватары.

**Цели этого плана:**
1. Поэтапная децентрализация доставки сообщений
2. NFT интеграция (галерея + NFT как аватар)
3. Реал-тайм отображение баланса при пополнении
4. Система аватаров (генеративные, бесплатные, NFT, премиум)

---

## Статус реализации

| # | Фича | Статус | Дата |
|---|-------|--------|------|
| 1 | Реал-тайм баланс | ✅ Готово | 2026-03-26 |
| 2 | Кошелёк платформы | ✅ Готово | 2026-03-26 |
| 3 | Подпись сообщений (Solana) | ✅ Готово | 2026-03-26 |
| 4 | NFT интеграция + аватар | ✅ Готово | 2026-03-27 |
| 5 | E2E шифрование | ✅ Готово | 2026-03-27 |
| 6 | Галерея аватаров | ✅ Готово | 2026-03-27 |
| 7 | E2E ключи привязаны к userId | ✅ Готово | 2026-04-01 |
| 8 | Привязка внешнего кошелька (Settings) | ✅ Готово | 2026-04-01 |
| 9 | Внутренние переводы PLS между юзерами | ✅ Готово | 2026-04-01 |
| 10 | Верификация и значки перенесены в Settings | ✅ Готово | 2026-04-01 |
| 11 | Счётчик непрочитанных на аватарке в чат-листе | ✅ Готово | 2026-04-01 |
| 12 | Пикер эмодзи в поле ввода | ✅ Готово | 2026-04-02 |
| 13 | Saved Messages (избранное) | ✅ Готово | 2026-04-08 |
| 14 | Совместные чек-листы | ✅ Готово | 2026-04-09 |
| 15 | Опросы (single + multi) | ✅ Готово | 2026-04-10 |
| 16 | Голосовые сообщения + waveform | ✅ Готово | 2026-04-11 |
| 17 | @mentions + таргет-пуши | ✅ Готово | 2026-04-12 |
| 18 | Отложенная отправка (до 30 дней) | ✅ Готово | 2026-04-13 |
| 19 | Тихие часы (per-user TZ) | ✅ Готово | 2026-04-14 |
| 20 | Pulsar Premium (5000 PLS / мес) | ✅ Готово | 2026-04-16 |
| 21 | Обои чата (Premium) | ✅ Готово | 2026-04-17 |
| 22 | Drag & drop, paste image | ✅ Готово | 2026-04-18 |
| 23 | Пополнение PLS за рубли (YooKassa, 5 пакетов до -40%) | ✅ Готово | 2026-04-19 |
| 24 | История транзакций кошелька | ✅ Готово | 2026-04-19 |
| 25 | Whisper-транскрипция голосовых (Premium, через relay-VPS) | ✅ Готово | 2026-04-20 |
| 26 | Стейкинг PLS (4 тира 7/30/90/365 дней) | ✅ Готово | 2026-04-22 |
| 27 | Ежедневная лотерея (2 пула) | ✅ Готово | 2026-04-23 |
| 28 | Активити-награды (PLS за реальные сообщения) | ✅ Готово | 2026-04-25 |
| 29 | Доход владельцам каналов/групп | ✅ Готово | 2026-04-27 |
| 30 | Голосования сообщества (треasury, квадратичный голос) | ✅ Готово | 2026-04-28 |
| 31 | Адаптация настроек/админки под мобилу | ✅ Готово | 2026-04-28 |
| 32 | CI восстановление + автомиграции prisma | ✅ Готово | 2026-04-28 |
| 33 | SuperChat / донаты в каналах с подсветкой | 🔄 В работе | — |
| 34 | Буст каналов (Discord-style) | ✅ Готово | 2026-04-30 |
| 35 | Магазин стикеров/эмодзи | 🔲 В очереди | — |
| 36 | Кастомизация профиля (рамка/фон/цвет пузырей) | ✅ Готово | 2026-04-30 |
| 37 | Founder-бейдж (SUPER_ADMIN визуал) | ✅ Готово | 2026-04-30 |
| 38 | Авто-система модераторов (по заслугам) | 🔲 В очереди | — |
| 39 | Android APK через Bubblewrap (тест на друзьях) | 🔲 В очереди | — |
| 40 | Capacitor + Solana MWA + FCM (Play Store) | 🔲 После теста APK | — |
| 41 | P2P WebRTC для DM (signaling через сервер) | ✅ Готово | 2026-04-30 |
| 42 | IPFS/Arweave хранение | 🔲 Опционально | — |
| 43 | Публичный signaling-relay протокол (Phase 2 P2P) | ✅ Готово | 2026-05-01 |
| 44 | Relay-нода + PLS-награды (Phase 3 — slice A: backend готов) | ✅ Готово | 2026-05-01 |
| 45 | CLI-runner для нод (slice B Phase 3) | ✅ Готово | 2026-05-01 |
| 46 | Tauri Windows-десктоп (slice C Phase 3) | ✅ Готово (CI билдит .msi/.exe) | 2026-05-01 |
| 47 | Выделили pulsar-node как публичный репо для майнеров | ✅ Готово | 2026-05-02 |
| 48 | Десктоп-апдейтер (tauri-plugin-updater + minisign-подписи + latest.json) | ✅ Готово | 2026-05-02 |
| 49 | Cosmos-splash на логине (mantras + parallax-звёзды) | ✅ Готово | 2026-05-03 |
| 50 | Reverse-tunnel: десктоп-нода без port-forwarding (`/node-tunnel` + `/n/<id>`) | ✅ Готово | 2026-05-03 |
| 51 | Date-разделители в чате (Сегодня / Вчера / Позавчера / weekday / дата) | ✅ Готово | 2026-05-03 |
| 52 | Stop-кнопка в десктопе + idempotent start_runner | ✅ Готово | 2026-05-03 |
| 53 | TURN secret в проде (для пользователей с симметричным NAT) | ✅ Готово | 2026-05-03 |
| 54 | P2PIndicator: показывать через какую ноду пошёл трафик | ✅ Готово | 2026-05-03 |
| 55 | Бандл cloudflared в десктоп для «настоящей» децентрализации (опционально) | 🔲 В очереди | — |
| 56 | Live PLS-ticker + 24h sparkline в десктопе (sec-by-sec проекция) | ✅ Готово | 2026-05-04 |
| 57 | Hourly payouts (1h окно вместо 24h, snapshot в кошелёк через 24h freeze) | ✅ Готово | 2026-05-04 |
| 58 | Frameless window (custom titlebar, drag, fixed 420×620, custom scrollbar) | ✅ Готово | 2026-05-04 |
| 59 | Tabs в десктопе (Главное / Настройки) | ✅ Готово | 2026-05-04 |
| 60 | **Miner-storage Phase 0** — SQLite + tunnel-протокол (Store/Challenge/Fetch) + admin WS + round-trip test | ✅ Готово | 2026-05-04 |
| 61 | Miner-storage Phase 1 — dual-write (server пишет в Postgres И в N=3 нод) | 🔄 Следующее | — |
| 62 | Miner-storage Phase 2 — opt-in dual-read beta | 🔲 В очереди | — |
| 63 | Miner-storage Phase 3 — production rollout, Postgres → 24h fallback | 🔲 В очереди | — |
| 64 | Miner-storage Phase 4 — drop Postgres OfflineMessage table | 🔲 В очереди | — |
| 65 | Общая реферальная система (signup-бонус + % от mining-earnings) | ✅ Готово | 2026-05-05 |
| 66 | Always-on E2E для DM + автосинк pubkey при смене браузера | ✅ Готово | 2026-05-06 |
| 67 | Pulsar Android APK (Bubblewrap TWA + GH Actions auto-build) | ✅ Готово | 2026-05-06 |
| 68 | **Linked devices** — multi-device E2E (envelope.from + fan-out на N pubkey'ев) | ✅ Готово | 2026-05-07 |
| 69 | Android: кросс-публикация APK в публичный pulsar-node (приватный pulsar → публичный download) | ✅ Готово | 2026-05-07 |
| 70 | Первый публичный релиз `android-v0.1.0` (виден на pulsar-chat.fun/download) | ✅ Готово | 2026-05-07 |

---

## ✅ 1. Реал-тайм баланс при пополнении

**Реализовано:** Socket-событие `wallet:balance-updated` обновляет PLS-баланс в реальном времени без перезагрузки страницы. SOL-баланс отображается через RPC. Многошаговый прогресс в DepositModal: Signing → Confirming → Crediting → Done.

**Файлы:**
- `packages/shared/src/types/socket-events.ts` — событие `wallet:balance-updated`
- `apps/server/src/modules/wallet/wallet.routes.ts` — эмит после deposit/purchase/reward
- `apps/web/src/hooks/useSocket.ts` — слушатель обновления баланса
- `apps/web/src/components/wallet/DepositModal.tsx` — многошаговый UI
- `apps/web/src/components/wallet/WalletPanel.tsx` — отображение SOL-баланса

---

## ✅ 2. Кошелёк платформы

**Реализовано:** Настроен `PLATFORM_WALLET_ADDRESS` для приёма SOL-депозитов. Адрес передаётся серверу и фронтенду через docker-compose.

**Детали:**
- Платформенный кошелёк: `Dsjy3Wd8ULCLaunuBt3rYXnYTRyn1jYcQEPcmwS1gmZh`
- Сеть: devnet
- `VITE_PLATFORM_WALLET` передаётся как build arg в Docker

---

## ✅ 3. Подпись сообщений (Solana wallet)

**Реализовано:** Каждое сообщение криптографически подписывается кошельком отправителя через wallet adapter (Phantom/Solflare). Подпись и адрес кошелька сохраняются в БД. В UI отображается зелёный щит (ShieldCheck) у подписанных сообщений.

**Payload для подписи:** `${chatId}:${timestamp}:${SHA256(content)}`

**Файлы:**
- `apps/web/src/crypto/messageSigner.ts` — подпись через wallet adapter
- `apps/server/src/socket/handlers/messageHandler.ts` — сохранение signature/signerWallet
- `apps/web/src/components/chat/MessageBubble.tsx` — иконка ShieldCheck
- `apps/web/src/components/chat/MessageInput.tsx` — подпись перед отправкой

**Схема БД (Message):**
```prisma
signature    String? @db.VarChar(128)
signerWallet String? @map("signer_wallet") @db.VarChar(64)
```

---

## ✅ 4. NFT интеграция + NFT как аватар

**Реализовано:** Helius DAS API для получения NFT, Redis-кэш 5 мин, PostgreSQL-кэш для метаданных. Проверка владения перед установкой аватара. Анимированная градиентная рамка (Solana-цвета) для NFT-аватаров во всём приложении.

**API эндпоинты:**

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/nft/gallery` | NFT текущего пользователя |
| GET | `/nft/gallery/:wallet` | NFT любого кошелька |
| POST | `/nft/set-avatar` | Установить NFT как аватар |
| POST | `/nft/clear-avatar` | Убрать NFT-аватар |

**Файлы:**
- `apps/server/src/modules/nft/nft.service.ts` — Helius DAS API, кэширование, верификация
- `apps/server/src/modules/nft/nft.routes.ts` — REST-эндпоинты
- `apps/web/src/components/nft/NftGallery.tsx` — грид-галерея NFT
- `apps/web/src/components/nft/NftCard.tsx` — карточка NFT
- `apps/web/src/components/ui/NftAvatarBorder.tsx` — анимированная рамка

**Env:** `HELIUS_API_KEY`, `HELIUS_RPC_URL`

---

## ✅ 5. E2E шифрование

**Реализовано:** NaCl-box (X25519 + XSalsa20-Poly1305) через tweetnacl. Ключи генерируются при логине и хранятся в IndexedDB. Публичные части загружаются на сервер. DM сообщения шифруются на клиенте — сервер хранит только шифротекст. Индикатор замка в поле ввода и у зашифрованных сообщений.

**Поток:**
1. При логине → генерация X25519 keypair → IndexedDB + `POST /keys/bundle`
2. Перед отправкой DM → `GET /keys/bundle/:userId` → nacl.box(content, nonce, recipientPub, mySecret)
3. Сервер хранит `encryptedContent`, `content = null`
4. Получатель дешифрует через свой приватный ключ + публичный ключ отправителя
5. При logout → ключи удаляются из IndexedDB

**Файлы:**
- `apps/web/src/crypto/keyManager.ts` — генерация/хранение ключей в IndexedDB
- `apps/web/src/crypto/e2eEncrypt.ts` — шифрование/дешифрование
- `apps/server/src/modules/keys/keys.routes.ts` — API ключей
- `apps/server/src/db/schema.prisma` — модель UserKeyBundle

**Схема БД (Message):**
```prisma
encryptedContent String? @map("encrypted_content") @db.Text
encryptionType   String? @map("encryption_type") @db.VarChar(32)
```

---

## ✅ 6. Галерея аватаров

**Реализовано:** Единая галерея с 4 вкладками:

1. **Уникальные** — генеративные аватары из wallet address (абстрактные фигуры в цветах Pulsar, 12 вариантов на пользователя)
2. **Бесплатные** — из папки `/avatars/free/` (пополняется вручную)
3. **NFT** — из Helius API с проверкой владения + анимированная рамка
4. **Премиум** — покупка за PLS из `/avatars/premium/`

Генеративные аватары используются как дефолтные во всём приложении (список чатов, хедер, сообщения, профили, друзья).

**Файлы:**
- `apps/web/src/components/profile/AvatarGallery.tsx` — галерея с вкладками
- `apps/web/src/components/ui/GenerativeAvatar.tsx` — SVG-генератор из seed
- `apps/web/public/avatars/free/` — бесплатные аватары
- `apps/web/public/avatars/premium/` — премиум аватары

---

## ✅ 7. E2E ключи привязаны к userId

**Реализовано:** Ключи NaCl в IndexedDB хранятся с ключом `e2e-keys-{userId}` — выживают logout/login, не удаляются при смене сессии. `initializeE2EKeys(userId)` вызывается при логине и fetchMe.

**Файлы:**
- `apps/web/src/store/authStore.ts` — передача userId в initializeE2EKeys
- `apps/web/src/crypto/keyManager.ts` — ключ IndexedDB включает userId

---

## ✅ 8. Привязка внешнего кошелька (Settings)

**Реализовано:** Пользователи с custodial-кошельком могут привязать Phantom/Solflare в разделе Настройки → Кошелёк. Флоу: nonce → подпись → верификация на сервере → обновление `walletAddress` + `walletType = EXTERNAL`.

**API эндпоинты:**
- `POST /users/me/wallet/nonce` — генерация 5-минутного nonce (Redis)
- `POST /users/me/wallet/link` — верификация подписи, обновление кошелька

**Файлы:**
- `apps/server/src/modules/user/user.routes.ts` — эндпоинты привязки
- `apps/web/src/components/settings/SettingsPanel.tsx` — `LinkWalletSection`

---

## ✅ 9. Внутренние переводы PLS между юзерами

**Реализовано:** Атомарный перевод PLS между пользователями на уровне БД (без блокчейн-комиссий). Кнопка "Перевести" в Settings → Кошелёк и в хедере DM-чата. Поиск получателя по username, подтверждение суммы. Socket-событие обновляет баланс обоих пользователей реал-тайм.

**API:** `POST /wallet/transfer { toUserId, amount }`

**Файлы:**
- `apps/server/src/modules/wallet/wallet.routes.ts` — эндпоинт transfer
- `apps/web/src/components/wallet/TransferModal.tsx` — UI перевода
- `apps/web/src/components/layout/ChatArea.tsx` — кнопка в хедере DM
- `packages/shared/src/types/socket-events.ts` — тип TRANSFER добавлен

---

## ✅ 10. Верификация и значки перенесены в Settings

**Реализовано:** Секции "Уровни верификации" и "Профильные значки" убраны из WalletPanel и перенесены в Настройки → Профиль как две кнопки с модальными окнами (z-index 60).

**Файлы:**
- `apps/web/src/components/settings/SettingsPanel.tsx` — VerificationModal, BadgesModal
- `apps/web/src/components/wallet/WalletPanel.tsx` — секции удалены

---

## ✅ 11. Счётчик непрочитанных на аватарке

**Реализовано:** При получении нового сообщения в неактивном чате на аватарке в чат-листе появляется красный бейдж с числом. При открытии чата счётчик сбрасывается. Если есть непрочитанные — индикатор онлайна скрывается.

**Файлы:**
- `apps/web/src/components/chat/ChatListItem.tsx` — бейдж на аватарке
- `apps/web/src/hooks/useSocket.ts` — инкремент unreadCount на message:new
- `apps/web/src/store/chatStore.ts` — сброс unreadCount при setActiveChat

---

## ✅ 12. Пикер эмодзи

**Реализовано:** Встроенный пикер без внешних зависимостей. 7 категорий (эмоции, жесты, символы, животные, еда, спорт, транспорт), ~500+ эмодзи. Открывается по кнопке 😊 в поле ввода, вставляет эмодзи в текст, закрывается кликом вне пикера.

**Файлы:**
- `apps/web/src/components/chat/EmojiPicker.tsx` — компонент пикера
- `apps/web/src/components/chat/MessageInput.tsx` — интеграция кнопки и пикера

---

## ✅ 13. P2P WebRTC Data Channels

Прямое P2P-соединение для DM между онлайн-пользователями работает. Polite-peer pattern, deterministic offerer/answerer. Signaling идёт через signaling-relay (Phase 2), fallback на socket.io. Если ICE собирается за 8 сек — сообщения летят мимо сервера, иначе тихо откатываемся на server-relayed путь.

**Файлы:**
- `apps/web/src/p2p/PeerConnection.ts` — RTCPeerConnection + data channel + signaling-collision-resolution
- `apps/web/src/p2p/MessageTransport.ts` — `sendDmMessage()` пытается P2P первым, fallback на socket.emit
- `apps/web/src/p2p/iceServers.ts` — STUN (Google + Cloudflare) + опц. TURN через `/api/v1/turn/credentials`
- `apps/web/src/p2p/peerStore.ts` — Zustand-стор: per-peer state (idle/connecting/open/failed)
- `apps/web/src/components/chat/P2PIndicator.tsx` — ⚡ переключатель в шапке DM
- `apps/server/src/socket/handlers/webrtcHandler.ts` — fallback signaling через socket.io
- coturn в `infra/docker/turn/` (TURN_AUTH_SECRET — TBD на проде)

---

## ✅ 15. Сеть нод + reverse-tunnel + PLS-награды

Полный pipeline десктопной ноды: пользователь регает ноду на сайте (Verification Level 3), получает 64-hex токен, ставит Tauri-приложение, вставляет токен — нода поднимает исходящий ws-туннель к `wss://pulsar-chat.fun/node-tunnel`. Центральный relay валидирует токен, регистрирует туннель, мультиплексирует браузерные сессии через `wss://pulsar-chat.fun/n/<nodeId>`. Никакого port forwarding или Cloudflare. За uptime + bandwidth + уникальные пиры капают PLS (формула 50/25/5, кап 2500/день/нода, 24h freeze).

**Ключевые файлы:**

*Серверная сторона:*
- `apps/server/src/modules/nodes/nodes.routes.ts` — register / proof / public list / by-token / heartbeat
- `apps/server/src/modules/nodes/nodes.service.ts` — формула + reportTunneledNodes() + listPublicNodes() мерджит DB-ноды (свой endpoint) с туннелированными (synthetic `wss://pulsar-chat.fun/n/<id>`)
- `apps/server/src/modules/nodes/nodesWorker.ts` — daily payoutNodes() + releasePendingRewards()
- `apps/relay/src/index.ts` — Node-relay контейнер: pubsub /ws, тоннель /node-tunnel (валидация через `/api/v1/nodes/by-token`), мультиплексор /n/<id>, periodic heartbeat в auth-сервер

*Web-клиент:*
- `apps/web/src/p2p/relays.ts` — bootstrapRelays() фетчит /public, шуффлит в front of rotation
- `apps/web/src/p2p/RelayClient.ts` — ждёт bootstrap до 1.5s перед openNext (community-нода реально побеждает гонку)

*Десктоп (pulsar-node репо):*
- `desktop/src-tauri/src/runner.rs` — параллельные таски: TCP listener (порт 3030 для тех у кого port forwarding), исходящий тоннель (для всех остальных), proof-loop. Auto-reconnect на drop. Стоп через RunnerHandle.abort().
- `desktop/src-tauri/src/lib.rs` — Tauri commands: get/save_config, start/stop_runner, lookup_token (HTTP в обход webview CORS), runner_status
- `desktop/ui/index.html` — RU/EN UI, Save & Start / красная Stop / Check for updates, withGlobalTauri:true
- GitHub Actions (`pulsar-node/.github/workflows/desktop-release.yml`) — matrix Win+Linux, signing через minisign-keypair (TAURI_SIGNING_PRIVATE_KEY), `latest.json` манифест публикуется в release
- `pulsar-node/scripts/gen_updater_key.py` + `reencrypt_updater_key.py` — самописные генераторы minisign-encrypted-with-empty-password ключей (Tauri требует именно encrypted, даже с empty password)

**Что было сложным:**
- Tauri-апдейтер: `check` возвращает `{rid, version}`, не `{available}` — фикс v0.1.19. `download_and_install` требует `rid` — фикс v0.1.22.
- Подпись тауриных бандлов: ключ должен быть encrypted-with-empty-password в формате minisign 0.7+; в env должна быть base64-кодировка ВСЕГО файла (с шапкой `untrusted comment:`), а не только base64-строка ключа.
- nginx regex `~ "^/n/[a-f0-9-]{36}$"` — `{36}` без кавычек интерпретируется nginx как блок-делимитер.
- runner.rs: `tokio::spawn` из синхронного `#[tauri::command] fn` паникует — нет рантайма в воркер-потоке. Через `tauri::async_runtime::spawn` работает.

**Что осталось:**
- TURN_AUTH_SECRET в .env на проде (для пользователей с симметричным NAT, в основном мобильный интернет)
- P2PIndicator: показывать через какую ноду пошёл трафик (UX-плюшка)
- Опционально: бандл cloudflared в десктоп → нода получает свой публичный URL без зависимости от pulsar-chat.fun (настоящая децентрализация для гиков)

---

## 🔲 16. IPFS/Arweave хранение (опционально)

Зашифрованные сообщения хранятся на IPFS/Arweave для перманентного децентрализованного хранения. CID/tx ID сохраняется в metadata сообщения.

**Не рекомендуется как приоритет** — дорого, сложно, PostgreSQL с бэкапами надёжнее.

---

## Технический стек

| Компонент | Технология |
|-----------|------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| Backend | Node.js + Fastify + Socket.IO + Prisma + PostgreSQL + Redis |
| Blockchain | Solana (devnet) + @solana/web3.js + wallet-adapter |
| Шифрование | tweetnacl (NaCl-box), X25519 + XSalsa20-Poly1305 |
| NFT API | Helius DAS API |
| Хранение ключей | IndexedDB (idb-keyval) |
| Деплой | Docker Compose на VPS |
| i18n | 11 языков (ru, en, de, fr, es, zh, ja, ko, tr, uk, pt) |
