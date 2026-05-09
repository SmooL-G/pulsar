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
| 71 | PLS price informer + 6 валют (USD/RUB/EUR/UAH/KZT/BYN), карточка на дашборде/кошельке/логине | ✅ Готово | 2026-05-07 |
| 72 | **P2P-биржа PLS** (внутренний эскроу-маркетплейс: продавец/покупатель/спор, авто-отмена) | ✅ Готово | 2026-05-07 |
| 73 | P2P L2-гейт (защита от throwaway-сибилов) | ✅ Готово | 2026-05-07 |
| 74 | **Гибридный курс PLS** — admin-референс + 7д volume-weighted market со clamp ±50% | ✅ Готово | 2026-05-07 |
| 75 | PLS sparkline (24h/7d/30d) на карточке курса — hourly snapshot worker + SVG-чарт без зависимостей | ✅ Готово | 2026-05-07 |
| 76 | P2P risk warning + /p2p/terms (двуязычная страница условий, чекбокс-acknowledgement, всегда-видимый disclaimer) | ✅ Готово | 2026-05-07 |
| 77 | Merchant tiers — TRUSTED auto + OFFICIAL paid (500 PLS заявка + 50k/год подписка), 0.5% fee, sorted-on-top, золотая обводка | ✅ Готово | 2026-05-08 |
| 78 | Гибкие сроки merchant-подписки (1/3/6/12 мес со скидкой до 20%), админ видит запрошенный срок | ✅ Готово | 2026-05-08 |
| 79 | Streaming-download файлов через Fastify (Range support, фикс залипания на 50% из-за Cloudflare timeout) | ✅ Готово | 2026-05-08 |
| 80 | Десктоп v0.1.35 — переключатель валют (6 фиатов) + фиат-сумма рядом с PLS в Earnings tile | ✅ Готово | 2026-05-08 |
| 81 | Burn ledger — явная запись всех неявных burn'ов (P2P fee, merchant fee/sub) + публичный счётчик `/api/v1/economy/stats` + виджет на дашборде | ✅ Готово | 2026-05-08 |
| 82 | Halving schedule в коде — каждые 2 года автоматически (anchor 2026-05-01), endpoint `/api/v1/economy/halving` для UI-обратного отсчёта | ✅ Готово | 2026-05-08 |
| 83 | Halving + burn виджеты на /mining + в десктопе v0.1.36 (Tauri-команды fetch_halving / fetch_economy_stats) | ✅ Готово | 2026-05-08 |
| 84 | Десктоп v0.1.37 — «🏆 Всего заработано» вынесено в hero-блок рядом с 24h | ✅ Готово | 2026-05-08 |
| 85 | Live pulse — `X онлайн · Y печатают сейчас` через ZSET + endpoint `/api/v1/economy/pulse`, виджет на дашборде/login | ✅ Готово | 2026-05-08 |
| 86 | Trade chat — мини-чат buyer↔seller внутри TradeDetailModal (плейнтекст для админ-арбитража, 3с polling) | ✅ Готово | 2026-05-08 |
| 87 | Marketing positioning hook + Open Beta badge (login/info/SEO/og/twitter) | ✅ Готово | 2026-05-08 |
| 88 | **AI-агенты в чате** — расширено в section 19 (категории А = productivity, Б = crypto co-pilot) | 🔲 В очереди | — |
| 88a | 🧠 Catch-up summary — «что я пропустил?» по последним N сообщениям | 🔲 MVP | — |
| 88b | 🌍 Inline translator — авто-перевод входящих с tap-to-reveal (1 PLS / msg → burn) | 🔲 MVP | — |
| 88c | 🔍 Find anything (NL search) — «найди где Боб скидывал кошелёк» | 🔲 В очереди | — |
| 88d | ✍️ Reply Helper — 3 кнопки-кратких-ответа на длинные сообщения | 🔲 В очереди | — |
| 88e | 🎨 Tone changer — перепишет draft мягче/жёстче/официальнее | 🔲 В очереди | — |
| 88f | 📅 Calendar extractor — «встретимся вторник 15:00» → одной кнопкой в календарь | 🔲 В очереди | — |
| 88g | 🤖 **Pulsar Assistant** — RAG-помощник по платформе (Terms/FAQ/инструкции) | 🔲 В очереди | — |
| 88h | 🛡 **Group Moderator** — авто-варн / приветствие / FAQ (500 PLS/мес за группу) | 🔲 В очереди | — |
| 88i | 📊 **Mining Advisor** — прогноз заработка, алерты по нодам, советы | 🔲 В очереди | — |
| 88j | ✍️ **Channel Writer** — генерит/переписывает посты для каналов (50 PLS/post) | 🔲 В очереди | — |
| 88k | 🎫 **Merchant Support** — 24/7 ответы покупателям (бесплатно для OFFICIAL) | 🔲 В очереди | — |
| 88l | 💰 **One-click crypto actions** — Боб написал «скинь 500 PLS» → шторка «Отправить?» | 🔲 MVP | — |
| 88m | 📊 **P2P merchant analyzer** — AI-summary репутации продавца на карточке offer | 🔲 MVP | — |
| 88n | 🤖 Wallet advisor — «у тебя 50k PLS, рекомендую stake/list/hold» | 🔲 В очереди | — |
| 88o | 🎯 Auto-trader (NL) — «купи если ниже $0.0008» → ставит P2P-лимиты сам | 🔲 Опционально | — |
| 88p | 🔮 PLS forecast — прогноз цены на 30 дней по trade-history + halving | 🔲 В очереди | — |
| 88q | 🛡 Scam detector в DM — флагает phishing-паттерны для незнакомцев | 🔲 В очереди | — |
| 88r | 💱 Trading Buddy — анализ сделок, алерты по курсу, расчёт спреда | 🔲 В очереди | — |
| 89 | 🥇 **Pay-to-DM-strangers** — DM незнакомому требует X PLS, при ответе возврат, при игноре остаётся получателю (10% → burn) | 🔲 В очереди | — |
| 90 | 🥈 **Bounty-сообщения** — Stack Overflow внутри чата, эскроу PLS, community vote выбирает ответ (5% → burn) | 🔲 В очереди | — |
| 91 | 🥉 **Group Treasury** — каждая группа = mini-DAO с общим PLS-кошельком и голосованием | 🔲 В очереди | — |
| 92 | **`/airdrop` команда** для админов каналов — auto-распределение PLS активным юзерам (5% → burn) | 🔲 В очереди | — |
| 93 | **Onchain reactions = микро-донаты** — каждый лайк = 1 PLS автору, 0.1 PLS → burn | 🔲 В очереди | — |
| 94 | 🔥 **AI-поиск на главной** (Perplexity-стиль) — поисковая строка по центру landing'а, Claude + web_search, free-tier → 5 PLS/запрос burn | 🔲 **MVP** | — |
| 95 | 📺 **Live-стримы блогеров** (Phase 1: SFU MVP) — стрим из группы, до 50 viewers, публичный URL `/live/<streamer>` | 🔲 В очереди | — |
| 95a | 📺 Phase 2: routing через miner nodes — viewers коннектятся к ближайшей ноде, миннеры получают PLS за bandwidth | 🔲 В очереди | — |
| 95b | 📺 Phase 3: featured-плитка стримов на landing — платные слоты (X PLS/час → burn) + free-tier по viewer count | 🔲 В очереди | — |
| 95c | 📺 Phase 4: Live-tipping (zips PLS во время стрима, 5% burn) + sub-only chat + recording | 🔲 В очереди | — |
| 96 | 🤖 **Pulsar GPT** — встроенный бот с мульти-модельным AI: chat + image gen + image animation + text→video, PLS или YooKassa | 🔲 **MVP** | — |

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

## ✅ 17. Экономика: курс PLS, P2P-биржа, мерчанты (76→80)

Самостоятельная подсистема для **вывода и обмена PLS**, поверх существующего внутреннего токена. Состоит из четырёх связанных частей:

### 17.1. Цена и информер

**Реализовано:**
- `GET /api/v1/price` — публичный endpoint, возвращает effective PLS-курс в USD + FX-курсы (RUB/EUR/UAH/KZT/BYN), кеш 60с в Redis. Источник FX — `open.er-api.com` (бесплатно, без ключа), 1ч-кеш с фоллбеком.
- **Гибридный курс**: admin-задаваемый референс + 7-дневный volume-weighted average по RELEASED P2P-сделкам со clamp ±50% от референса. Анти-манипуляция: сделки <1000 PLS игнорируются, ≤5 сделок одной пары в окне.
- Admin Settings → «Курс PLS (админ)» (только SUPER_ADMIN): текущий effective + breakdown (референс vs market) + поле «Установить новый» с журналом изменений (`PlsPriceReference` append-only).
- `useDisplayCurrency` Zustand-store с авто-выбором по `navigator.language`, persist в localStorage. Доступен из любой точки UI.
- `<PlsPriceCard />` — карточка с курсом, 24h-дельтой, мини-чартом, дропдауном валюты, опциональным фиат-эквивалентом баланса. Стоит на dashboard, в кошельке и на login (через `<PlsPriceBadge />`).
- `<PriceSparkline />` — SVG-чарт без зависимостей, окна 24h/7d/30d. Источник — hourly snapshot worker (`PlsPriceSnapshot`, 90д ретеншн).

**Файлы:**
- `apps/server/src/modules/price/price.routes.ts` — `/`, `/history`, `/admin`
- `apps/server/src/modules/price/price.service.ts` — `getEffectivePrice`, `setReferencePrice`
- `apps/server/src/modules/price/price.worker.ts` — hourly snapshot
- `apps/web/src/hooks/usePlsPrice.ts` — fetch+cache, currency store, helpers
- `apps/web/src/components/price/PlsPriceCard.tsx`, `PriceSparkline.tsx`
- `apps/web/src/components/settings/PlsPriceAdminSection.tsx`

### 17.2. P2P-биржа

**Реализовано:**
- Двухсторонний marketplace: SELL (продавец залочивает PLS при создании) и BUY (продавец залочивает при отклике на заявку покупателя). Симметричный API.
- Trade lifecycle: `PENDING_PAYMENT` (30-мин таймер) → `PAID` (покупатель отметил) → `RELEASED` (продавец подтвердил, PLS уходят покупателю минус комиссия) → опционально `DISPUTED` (админ-арбитраж) или `CANCELLED` (любой стороной до оплаты или авто после таймера).
- Эскроу через `PlsWallet.lockedAmount` (spendable = balance − lockedAmount). Worker раз в минуту авто-отменяет просроченные `PENDING_PAYMENT`.
- Платформенная комиссия: 1% по умолчанию, **0.5% для OFFICIAL мерчантов**.
- L2-гейт: `assertEligible()` блокирует createOffer/openTrade для уровней <2, защищает от throwaway-сибилов. UI рендерит EligibilityGate с CTA на повышение уровня.
- Risk-warning модалка перед первым действием (localStorage-acknowledgement, версионируется), всегда-видимый disclaimer в шапке `/p2p`, полная двуязычная страница `/p2p/terms`.
- Сортировка marketplace: OFFICIAL → TRUSTED → NONE → date desc. OFFICIAL карточки получают золотую обводку и свечение.

**Файлы:**
- `apps/server/src/modules/p2p/p2p.routes.ts`, `p2p.service.ts`, `p2p.worker.ts`
- `apps/web/src/pages/P2PPage.tsx`, `P2PTermsPage.tsx`
- `apps/web/src/components/p2p/TradeDetailModal.tsx`, `RiskWarningModal.tsx`

### 17.3. Merchant-программа

**Реализовано:**
- Три тира на `User.merchantTier`: `NONE` (обычный), `TRUSTED` (auto), `OFFICIAL` (paid).
- **TRUSTED** — авто-промоушен hourly worker'ом: ≥10 RELEASED-сделок, 0 disputes за 30 дней, аккаунт ≥60 дней. Бесплатно. Демоушен при выходе из критериев.
- **OFFICIAL** — заявка через `/merchant/apply` (500 PLS невозвратно, фильтрует спам) + ручное одобрение админом + платная подписка. Гибкие сроки: **1 / 3 / 6 / 12 мес** со скидкой до 20% за длинный коммит. Daily worker downgrade'ит истёкших.
- Цены в `SUBSCRIPTION_PRICES` map (5k / 14k / 26k / 48k PLS). Менять без рестарта — через прямую правку константы и redeploy.
- Бенефиты OFFICIAL: золотая корона на карточках, прикреплён вверху marketplace, 0.5% fee, приоритет в спорах. `requestedMonths` сохраняется на заявке для админа.
- Settings → «Статус мерчанта» (всем) + «Заявки мерчантов (админ)» (SUPER_ADMIN) с одним кликом одобрить/отклонить.

**Файлы:**
- `apps/server/src/modules/merchant/merchant.service.ts` — apply/approve/reject/renew/sweep
- `apps/server/src/modules/merchant/merchant.routes.ts`
- `apps/server/src/modules/merchant/merchant.worker.ts` — hourly trusted sweep + daily expiry
- `apps/web/src/components/settings/MerchantSection.tsx`, `MerchantAdminSection.tsx`

### 17.4. Десктоп (pulsar-node v0.1.35)

**Реализовано:**
- Переключатель валют рядом с переключателем языка в шапке десктоп-приложения.
- В Earnings tile под каждой PLS-цифрой отображается `≈ X RUB` (или выбранная валюта): сегодня / live-сессия / lifetime / frozen.
- Live-сессия пересчитывает фиат каждую секунду по той же формуле что и PLS.
- Цена тянется через Tauri-команду `fetch_price` (Rust → reqwest), чтобы обойти WebView CORS, кеш на стороне сервера (60с) + клиентский poll каждые 5 минут.

**Файлы:**
- `pulsar-node/desktop/src-tauri/src/lib.rs` — команда `fetch_price`
- `pulsar-node/desktop/ui/index.html` — `ccy-toggle` button, `fetchPrice()`, `setFiatLabel()`

**Что было сложным:**
- Multi-decimal Decimal-тип в Prisma vs `Number()` — `totalPriceUsd: trade.amount * pricePerPlsUsd` через `Prisma.Decimal.mul()` чтобы не потерять точность.
- Hooks-order в React (`MerchantSection`): добавил `useState` после early-return, словил React error #310. Хуки должны вызываться в одинаковом порядке — переместил выше.
- WebView CORS: первая попытка десктопа фетчить цену напрямую `fetch('/api/v1/price')` молча падала, fiat не отрисовывался. Перенёс в Rust через reqwest по образцу `fetch_stats` / `lookup_token`.
- Prisma OOM (exit 137): большая миграция (~6 новых таблиц + enum'ов) убилась дефолтным heap'ом. Поднял `NODE_OPTIONS=--max-old-space-size=4096` в deploy workflow.

---

## ✅ 17a. Защита курса PLS: burn ledger + halving (#81-#82)

Закрывает две главные «дыры» в защите токена от обесценивания:

### 17a.1. Прозрачный burn

До этого PLS-fees уходили в /dev/null имплицитно (контракт списывал с продавца, кредитил покупателя минус комиссия — разница просто исчезала). Никаких следов в БД, нечем хвастаться.

**Сейчас:**
- Новый `PlsTransactionType.BURN` в ledger'е
- `recordBurn()` хелпер пишет negative-amount транзакцию каждый раз когда supply реально уменьшается
- P2P releaseTrade → burn 1% (или 0.5% для OFFICIAL мерчантов)
- Merchant `debitPls` → burn 100% (application fee + subscription + renewal)
- `GET /api/v1/economy/stats` — public, кешируется 60с: `{ totalSupply, circulating, burned, burnedPctOfSupply }`
- Виджет «Сожжено навсегда» на дашборде с розово-оранжевым градиентом и счётчиком процента от total supply

**Маркетинговый эффект:** каждая P2P-сделка и merchant-подписка теперь визуально уменьшают supply. «При покупке PLS на бирже горят токены» — прямой defi-narrative.

### 17a.2. Halving schedule

**Защита от инфляции при росте miner-сети.** Зашит в код, никаких governance-голосований.

```
era 0  | 2026-05-01 → 2028-04-30 | 50 PLS/час  · 25/GB · 5/peer · cap 2500/день
era 1  | 2028-05-01 → 2030-04-30 | 25 PLS/час  · 12/GB · 2/peer · cap 1250/день
era 2  | 2030-05-01 → 2032-04-30 | 12 PLS/час  · 6/GB  · 1/peer · cap 625/день
...
```

**Реализация:**
- `BASE_RATE_PER_HOUR_BASE` и т.д. — immutable era-0 константы
- Геттеры (`getBaseRatePerHour()` etc.) делят на `2^era` живьём при каждом вызове — рестарт сервера на дату halving не нужен
- `payoutNodes()` использует геттеры
- Endpoint `GET /api/v1/economy/halving` отдаёт era + nextHalvingAt + currentRates → готово для UI-countdown «До следующего halving N дней»

**Files:**
- `apps/server/src/modules/economy/burn.service.ts` — recordBurn / totalBurned / circulatingSupply
- `apps/server/src/modules/economy/economy.routes.ts` — /stats + /halving
- `apps/server/src/modules/nodes/nodes.service.ts` — halving formula + getters
- `apps/server/src/modules/p2p/p2p.service.ts` — burn после release
- `apps/server/src/modules/merchant/merchant.service.ts` — burn в debitPls
- `apps/web/src/components/economy/BurnedSupplyCard.tsx` — виджет

---

## ✅ 18. Файловые загрузки: streaming через Fastify + Range support

**Реализовано:** новый endpoint `GET /api/v1/files/dl?k=<s3key>&n=<filename>&t=<jwt>` стримит файл из MinIO/S3 через Fastify. До этого URL вёл напрямую в MinIO, и на медленных каналах загрузки падали на ~50% — Cloudflare/Nginx убивали соединение по таймауту.

**Что внутри:**
- HEAD на S3 для получения размера + content-type (быстрый 404, корректные заголовки)
- `Accept-Ranges: bytes` всегда + честная обработка `Range:` header → HTTP 206 с `Content-Range`. Браузеры/IDM умеют resume при обрыве.
- `Content-Disposition` с RFC 5987-encoded именем файла → правильное имя при сохранении.
- Auth: Bearer header нормально, но клик по `<a href>` его не шлёт — поэтому endpoint также принимает `?t=<jwt>` query-param. Клиент дописывает токен из localStorage только для URL'ов на `/api/v1/files/dl`.
- Старые сообщения с прямыми MinIO-ссылками продолжают работать без миграции.

**Файлы:**
- `apps/server/src/modules/files/files.routes.ts` (новый)
- `apps/server/src/modules/upload/upload.routes.ts` — новый формат URL в ответе
- `apps/web/src/components/chat/MessageBubble.tsx` — append `&t=` для protected эндпоинта

---

## 🔲 19. AI-агенты в чате (#88)

Расширение существующей bot-системы за счёт LLM-«мозга». Бот = команды и webhook (детерминированный); **агент = разговор и автономность в рамках своей роли**.

Делим на две категории:
- **А — productivity-помощники** (то что делают/могут все: copy Apple Smart Reply, Google translation)
- **Б — Crypto Co-pilot** (наш moat — то чего физически нет ни у кого, потому что у конкурентов нет своей валюты + on-chain интеграции)

---

### 🅰 Категория А: «Умный помощник» (productivity)

| Агент | Что делает | Монетизация |
|---|---|---|
| 🧠 **Catch-up summary** (#88a) | «Что я пропустил?» — суммаризирует последние N сообщений в группе/канале одним абзацем | **5 PLS/запрос → burn** ИЛИ бесплатно для Premium |
| 🌍 **Inline translator** (#88b) | Авто-перевод входящих с tap-to-reveal | **1 PLS/переведённое → burn** |
| 🔍 **Find anything (NL search)** (#88c) | «Найди где Боб скидывал кошелёк на прошлой неделе» → возвращает конкретное сообщение | **2 PLS/запрос → burn** |
| ✍️ **Reply Helper** (#88d) | 3 кнопки-кратких-ответа на длинные сообщения (как Gmail) | **Бесплатно** (drive engagement) |
| 🎨 **Tone changer** (#88e) | Перепишет твой draft мягче/жёстче/официальнее | **3 PLS/use → burn** |
| 📅 **Calendar extractor** (#88f) | «Встретимся вторник 15:00» → одной кнопкой в календарь | **Бесплатно** |
| 🤖 **Pulsar Assistant** (#88g) | RAG по Terms/FAQ/инструкциям, snimает support-нагрузку | **Бесплатный** (retention) |
| 🛡 **Group Moderator** (#88h) | Авто-варн / приветствие / FAQ-ответы | **500 PLS/мес за группу** |
| 📊 **Mining Advisor** (#88i) | Прогноз заработка + алерты по нодам | **Бесплатный** (retention миннеров) |
| ✍️ **Channel Writer** (#88j) | Генерит/переписывает посты для каналов | **50 PLS / сгенерированный пост** |
| 🎫 **Merchant Support** (#88k) | 24/7 ответы покупателям про реквизиты/статусы | **Включён в OFFICIAL-подписку** |

---

### 🅱 Категория Б: «Crypto Co-pilot» (наш moat)

То, чего физически нет ни у кого — потому что у конкурентов нет своей валюты + on-chain интеграции.

| Агент | Что делает | Уникальность |
|---|---|---|
| 💰 **One-click crypto actions** (#88l) | Боб написал «скинь 500 PLS» → шторка снизу: «Отправить 500 PLS Бобу? [Подтвердить]» | Telegram-бот так не может (E2E), наш агент работает client-side |
| 📊 **P2P merchant analyzer** (#88m) | На карточке offer AI-summary: «23 успешных сделки/мес, 0 disputes, avg release 12 мин» | Никто не агрегирует repu в 1 строку понятного русского |
| 🤖 **Wallet advisor** (#88n) | «У тебя 50k PLS — стейкни 30k под 10% APY, 20k оставь на P2P» | Crypto financial advice внутри мессенджера |
| 🎯 **Auto-trader (NL)** (#88o) | «Купи 10k PLS если упадёт ниже $0.0008» → ставит лимит на P2P автоматически | LocalBitcoins/Binance имеют только CEX-интерфейсы, голосовых команд нет |
| 🔮 **PLS forecast** (#88p) | На основе trade-history + halving: «Через 30д median цена ~$0.0011 ±15%» | Прогнозов на наш токен нет ни у кого, нужны наши же данные |
| 🛡 **Scam detector в DM** (#88q) | Если пишет незнакомец — флаг «8/10 phishing: просит seed phrase, обещает 10x» | Адаптировано под крипто-scam-паттерны |
| 💱 **Trading Buddy** (#88r) | Анализ сделок, алерты по курсу, расчёт спреда | Узкая ниша для активных трейдеров |

---

### Принципы монетизации

- **Pay-per-action с burn** — каждый запрос к платному агенту жжёт N PLS (укрепляет курс + revenue)
- **Free-tier с лимитом** — бесплатные агенты до N запросов/день, дальше топливо за PLS
- **Subscriptions** — «Pulsar Agents Premium» 1000 PLS/мес = безлимит на translator + trading + writer
- **B2B-тарифы** — для OFFICIAL мерчантов и крупных каналов

### Технические заметки

- **LLM:** Claude Haiku 4.5 для массовых задач (~$0.0008/1k tokens), Sonnet 4.6 только для тяжёлых (catch-up на 1000 сообщений, RAG поверх большого корпуса)
- **Маржа:** закладывать 4-10× от себестоимости токенов
- **Безопасность E2E:** агент работает на **клиенте** через WebAssembly или серверный proxy с явным consent. Серверу никогда не передаётся plaintext без opt-in
- **Cache + dedupe** одинаковых запросов (особенно RAG-ответы, FAQ)
- **Confirm-burn UX:** перед каждым платным запросом — модалка «Стоит 5 PLS. Подтвердить?». После 3-х подтверждений в session → auto-confirm

### 🎯 MVP scope (1 неделя — отмечено `🔲 MVP` в таблице)

Беру по 2 фичи из каждой категории — adoption + moat одновременно:

1. **#88a Catch-up summary** — самая универсальная, понятна каждому, мгновенный value
2. **#88b Inline translator** — драйвер для крипто-международных групп и P2P с иностранцами
3. **#88m P2P merchant analyzer** — снимает friction в P2P, прямой revenue impact
4. **#88l One-click crypto actions** — wow-эффект, то чем хвастаешься друзьям

Что **НЕ берём в MVP:**
- **Auto-trader (#88o)** — слишком рискованно (юзер теряет деньги → суды → reputation hit)
- **Wallet advisor (#88n)** — нужна реальная история, на старте мало данных
- **PLS forecast (#88p)** — нужно minimum 3-6 месяцев market data для нагата прогноза

Все остальные пункты #88c-k и #88n-r — `🔲 В очереди`, добавляем по мере роста adoption.

---

## 🔲 20. Уникальные механики (#89-93)

Пять фич, которых нет ни у одного конкурента (Telegram / Signal / Discord / WhatsApp). Все опираются на существующую PLS-экономику + анти-абьюз через burn → каждое использование укрепляет курс токена.

### 20.1. Pay-to-DM-strangers (#89)

**Проблема:** spam-DM от ботов и попрошаек — бич всех мессенджеров. Telegram пытался решать через Premium-фильтры, но без денежного потока (контактам можно бесплатно, остальным — нельзя).

**Решение:** DM незнакомому юзеру (не в друзьях) **требует депозит N PLS** (по умолчанию 10 PLS, настраивается получателем 0–10000 в его профиле).
- Получатель **отвечает в 24h** → PLS возвращаются отправителю минус 10% платформенного fee (5% получатель, 5% → burn)
- Получатель **игнорит / явно reject** → 100% PLS остаются у получателя (минус 10% burn)
- Если уже друзья → бесплатно, как обычно

**Уникальность:** реальное pricing анти-spam, popular-юзеры зарабатывают на DM (Cameo-подобно), но без отдельного приложения. Платформа жжёт стабильный поток PLS.

**Schema:**
- `User.dmFeePls BigInt @default(10)` — настраиваемая планка
- `Message.dmFeePaid BigInt?` — сумма депозита для DM
- background worker возвращает/конвертирует PLS через 24h

### 20.2. Bounty-сообщения (#90)

**Проблема:** в крипто-чатах постоянно «кто знает как сделать X?», ответы либо не приходят либо дают мусор. Stack Overflow умирает, дедикейтед платформ для Web3-Q&A нет.

**Решение:** любой пользователь может прикрепить **PLS bounty к сообщению**: «Кто настроит Phantom для Solana devnet — 🏆 5,000 PLS». PLS лочится в эскроу. Любой отвечает в треде. **Через 7 дней** автор вопроса (или community vote если автор не выбрал) присуждает приз → 95% PLS → ответчику, **5% → burn**.

**Уникальность:** первая нативная Q&A механика **внутри** мессенджера с реальным денежным incentive. Идеально для крипто/dev-каналов.

**Schema:**
- `MessageBounty { messageId, amount, status: OPEN | AWARDED | EXPIRED, winnerMessageId, expiresAt }`
- лочит в эскроу через `PlsWallet.lockedAmount` (та же логика что в P2P)

### 20.3. Group Treasury (#91)

**Проблема:** в Telegram у группы нет своих денег — невозможно скинуться на инструмент, оплатить хостинг общего бота, вознаградить активных, наказать токсичных.

**Решение:** **каждая группа автоматически получает PLS-кошелёк**. Любой участник может пополнить (`/deposit 1000`). Голосование (1 message = 1 vote ИЛИ quadratic от стейка) одобряет траты: пин-вознаграждения, штрафы за нарушения, оплата AI-модератора, спонсирование ивента.

**Уникальность:** каждая группа = мини-DAO. Идеально для крипто-DAO, IRL-friends pool, classroom funds, корпоративных тимбилдингов.

**Schema:**
- `GroupTreasury { chatId, balance, txnLog }`
- `GroupTreasuryProposal { chatId, type, amount, recipient, votes, expiresAt, status }`
- 2% на каждое исходящее списание → burn

### 20.4. /airdrop (#92)

**Проблема:** retention каналов падает, owner'ы не имеют tools для re-engagement. Сторонние airdrop-боты не интегрированы.

**Решение:** админ канала набирает `/airdrop 50000 PLS to last 100 active`. Бот-помощник (Pulsar Bot) автоматически отбирает 100 user'ов писавших в последние 24h, шлёт каждому 500 PLS. Создаёт **виральный момент** — все начинают активничать в надежде попасть в следующий airdrop.

Варианты:
- `/airdrop X PLS to last N active` — последние N активных
- `/airdrop X PLS to random N` — случайные N подписчиков
- `/airdrop X PLS to top N reacters` — топ N по реакциям за неделю

**Платформенная комиссия 5% → burn.**

**Уникальность:** airdrop встроен в мессенджер как первоклассная фича. Каналы-владельцы будут постоянно гонять airdrop'ы для retention'а → постоянный PLS-flow → постоянный burn.

### 20.5. Onchain reactions = микро-донаты (#93)

**Проблема:** лайки/реакции в любом мессенджере — бесплатный социальный сигнал, не имеют материальной ценности. Авторы хорошего контента не зарабатывают за каждый лайк.

**Решение:** каждая «лайк»-реакция (👍 / ❤️ / 🔥) = автоматический **донат 1 PLS** автору сообщения. **0.1 PLS** → burn. Нейтральные реакции (😂 / 🤔) бесплатные. Юзер с балансом <1 PLS не может ставить платные реакции (или фоллбэк на бесплатную модель).

**Опционально:** premium-реакции (💎) = 10 PLS, для подчёркивания особенно ценного контента.

**Уникальность:** меняет фундамент социальной механики. Хорошие посты приносят авторам PLS прямо в кошелёк. Никто не реализовал — невозможно без своей экономики и low-cost транзакций.

**Schema:**
- расширить `Reaction` полем `tipPls BigInt?`
- атомарный transfer в `addReaction` через `PlsWallet`

---

## 🔲 21. AI-поиск на главной странице (#94)

**Гипотеза acquisition-канала:** поиск — high-frequency action (10×/день), мессенджер — low (1-2×/день). Если поставить Perplexity-style search bar на login — визиторы заходят за поиском, остаются в чате. Конкуренты (Perplexity, SearchGPT) не имеют мессенджера, мы имеем оба → уникальная связка.

### Концепция UX

**Landing-страница до входа:**
- Огромная поисковая строка по центру (Google-style)
- Кнопка `Войти` справа сверху со свечением + анимацией (привлекает внимание после первого результата)
- Под строкой 3 кнопки-примера: «Что такое Solana?», «Как майнить Pulsar?», «Курс PLS сегодня»
- Beta-бейдж + tagline остаются

**После запроса (`/search?q=...`):**
- Streaming-ответ от Claude с typing-эффектом (ощущение «думающего ИИ»)
- 5-10 source-карточек снизу (ссылка + favicon + сниппет)
- Sticky-CTA сверху: «Понравилось? Войди в Pulsar — твой приватный угол интернета: поиск + общение в одном месте»
- Возможность задать follow-up вопрос (мини-чат с Claude в контексте предыдущего ответа)

### Монетизация и анти-абьюз

| Tier | Лимит | Цена |
|---|---|---|
| Анонимный (по IP) | **3 запроса/день** | бесплатно |
| Зарегистрированный | **10 запросов/день** | бесплатно |
| Дальше | без лимита | **5 PLS / запрос → burn** |

**Анти-абьюз:**
- Cloudflare Turnstile (или внутренний captcha) после 5 анонимных запросов
- Rate-limit per-IP через Redis: max 1 запрос/3 секунды
- Кеш в Redis на 24h по нормализованному запросу — повторные «что такое биткоин» не платят дважды (для нас → меньше расходов)

### Технический стек

- **LLM:** Claude API с **built-in `web_search` tool** (доступен с 2025) — не нужно интегрировать Brave/Tavily отдельно
- **Default model:** Haiku 4.5 для скорости + дешевизны (~$0.001-0.005/search). Sonnet 4.6 опционально для «Deep Research» режима за +20 PLS
- **Streaming:** Server-Sent Events (SSE) от Fastify → стримим ответ + источники в UI
- **Source rendering:** парсим `tool_use` results из Claude, формируем красивые карточки с favicon (через Google's `s2/favicons` proxy)
- **SEO:** генерируем static `<meta>` теги для каждого `/search?q=...` URL → Google индексирует → виральный traffic

### Brand-позиционирование

Риск размывания «мы мессенджер ИЛИ search?» решается лёгким переименованием landing-сабпродукта:

> **Pulsar AI** — твой приватный угол интернета.
> Поиск без рекламы и трекинга + общение в зашифрованных чатах.

Это снимает дисонанс: одно зонтичное приложение с двумя главными use case'ами, как у Telegram (chat + channels) или Discord (chat + voice).

### Backend skeleton

```
POST /api/v1/search
Body: { q: string, mode?: 'fast' | 'deep' }
Headers: X-Forwarded-For (для rate-limit)

Response: SSE-стрим
event: token        data: { delta: "..." }
event: source       data: { url, title, snippet, favicon }
event: done         data: { tokensUsed, plsCharged }
```

- Auth optional. Если есть Bearer → проверяем баланс PLS до запроса
- Если анонимный → проверяем дневной IP-лимит
- Если paid → атомарно списываем 5 PLS + recordBurn() в transaction

### MVP scope (3-4 дня)

1. **Backend:** `POST /api/v1/search` + Redis-кеш + IP/user rate-limit + PLS-debit
2. **Frontend:** новый `<SearchHero />` компонент на LoginPage — большая строка, 3 кнопки-примера, streaming-результат под ней
3. **Result page:** `/search?q=...` — sticky CTA + answer + sources + follow-up input
4. **Анти-абьюз:** простой rate-limit на старте, Turnstile добавляем когда придёт первый бот-флуд

### Что НЕ берём в MVP

- **Personalisation** (история запросов привязанная к юзеру) — accumulate потом
- **Image search / video understanding** — Sonnet с vision, дорого, добавим позже
- **Voice search** — отдельный effort, ждёт adoption
- **Browser extension** — заманчиво, но сложно поддерживать; ждёт первой 1k MAU

### Метрики успеха (что меряем после запуска)

- **CTR от поиска к регистрации** — целевое >5% (1 из 20 ищущих заводит аккаунт)
- **PLS-burn от платных запросов** — добавляется к дашборду «Сожжено навсегда»
- **Search latency p95** — целевое <3 секунды до первого токена
- **Cost-per-acquisition** — ежедневный USD-расход на LLM ÷ новые регистрации. Целевое <$0.50

---

## 🔲 22. Live-стримы блогеров через миннер-сеть (#95)

**Главная гипотеза:** живые стримы — это самый недооценённый для Pulsar канал привлечения. Twitch/YouTube не могут предложить блогерам долю в раздаче трафика — у них нет своей нод-сети. У нас она УЖЕ есть. Каждый блогер становится мотивирован заталкивать аудиторию ставить ноды → больше нод → лучше качество стрима → больше зрителей → ещё больше нод. Self-reinforcing flywheel.

Аналог по бизнес-модели: **Theta Network** — $100-300M валюация именно на этой механике. У нас сразу есть юзер-база, мессенджер и P2P-биржа в довесок.

### Phase 1 — MVP стримов (#95)

Простейшее работающее решение:
- Streamer открывает группу/канал и нажимает «Начать стрим»
- WebRTC SFU (Selective Forwarding Unit) на нашем сервере перебрасывает поток до 50 viewers
- Стрим виден всем: подписчикам в группе + любому по public URL `/live/<streamer-username>`
- Под видео — live-чат (использует существующую chat-инфру)
- Кнопки: 🎤/🎥 toggle, 👥 viewer count, ❤️ like

**Технически:**
- SFU: **mediasoup** (Node.js, активно поддерживается, сотни тысяч production-инсталляций) или **LiveKit** (Go, OSS, проще API)
- 1 streamer @ 720p ~2.5 Mbps × 50 viewers = 125 Mbps total — наш VPS вытягивает
- Запись в S3 опционально (на потом)

**Лимит 50 viewers** — намеренный, чтобы Phase 1 не разорил bandwidth. Снимется в Phase 2.

### Phase 2 — Routing через миннер-ноды (#95a)

**Главный технический и бизнесовый прорыв.**

- Каждая активная нода в `relay:tunneled-nodes` объявляет «у меня свободные N Mbps»
- Когда viewer открывает `/live/<streamer>`, сервер выдаёт ему **3 ближайших ноды** (по latency / GEO)
- Viewer → SFU → выбранная нода → viewer (нода работает как edge CDN)
- Каждая раздача GB через ноду = `BANDWIDTH_BONUS_PER_GB` × N PLS миннеру (наша уже существующая формула!)
- Если node идёт offline → viewer перепадает к следующей в списке (failover)

**Что это даёт:**
- Платформа НЕ платит за bandwidth — за него платят зрители (своим временем + трафиком ноды-владельцев)
- Миннеры зарабатывают **существенно больше** чем сейчас (сейчас bandwidth-бонус почти нулевой) → больше людей хочет ставить ноды
- Стримеры могут масштабироваться на тысячи зрителей без cost-blow-up
- Новая категория контента в Pulsar — IRL-стримы, gaming, podcasts

**Schema:**
- `LiveStream { id, streamerId, chatId, sfuRoomId, status: LIVE | ENDED, startedAt, endedAt, peakViewers }`
- `LiveStreamRouter` — Redis-структура с актуальными нодами и их load
- `NodeUptimeProof.bytesRelayed` уже есть, переиспользуем

### Phase 3 — Featured-плитка на landing (#95b)

- На главной странице (выше AI-search-бара #94) горизонтальная карусель «Сейчас в эфире»
- 6-8 плиток: thumbnail (live preview), название стрима, имя стримера, viewer-count
- **Платные слоты** — стримеры платят X PLS/час за гарантированную плитку (X PLS → burn)
- **Free-слоты** — top-K стримов по viewer count + recency автоматически попадают
- Клик по плитке → public-page `/live/<streamer>` без обязательного логина
- На странице sticky-CTA «Войди в Pulsar чтобы писать в чат + поддержать стримера PLS»

### Phase 4 — Live-tipping + advanced (#95c)

- 💸 **Tipping** во время стрима: viewer → 100/500/1000 PLS → стримеру (95% стримеру, 5% burn)
- Tip над плеером всплывает анимированно с username — соцпризнание мотивирует ещё тип
- 🔒 **Sub-only chat** — только подписчики канала могут писать в live-chat (премиум-фича для крупных стримеров)
- 📼 **Recording** — VOD после стрима, хранится 7 дней, premium = 30 дней
- 🎬 **Pre-roll/mid-roll реклама** — рекламодатели платят X PLS за показ всем viewers, 50% делится между viewers как «компенсация за просмотр» (уникальная механика — никто не платит юзерам за просмотр рекламы)

### Антифрод и модерация

- **Bandwidth-fraud check**: миннер не может репортить раздачу зрителям которых не было — серверная сверка уникальных connection IDs
- **NSFW detection** в первые 60 секунд стрима: AWS Rekognition / open-source тулза → авто-shadow-ban
- **Copyright music detection** — отдельный effort, поначалу полагаемся на user reports
- **Stream report** кнопка → 3 жалобы за час = пауза стрима + ручной admin-review

### Метрики успеха

- **Phase 1 launch:** 10 регулярных стримеров за первый месяц
- **Phase 2:** ≥80% стримов идёт через нодную раздачу (≤20% через сервер прямо)
- **Phase 3:** клик-rate с landing-плиток ≥2%, conversion в registration ≥5% от visit
- **Phase 4:** medianный tip от viewer ≥50 PLS, sustained burn ≥1k PLS/день от tip-fees

### Бюджет времени

- Phase 1 — **2-3 недели** (mediasoup integration + UI + базовая модерация)
- Phase 2 — **2-3 недели** (router-логика + интеграция с node tunneling)
- Phase 3 — **1 неделя** (UI карусели + paid-slot accounting)
- Phase 4 — **2 недели** (tipping flow + sub-only + recording)

**Итого:** 8-9 недель на полную реализацию, но Phase 1 уже даёт работающий продукт-фичу за 3 недели.

### Брендовая интеграция

Эту фичу можно подавать как «Pulsar TV» или «Pulsar Live» — отдельный sub-product с собственным narrative для стримеров: «**Стримь без YouTube. Зарабатывай PLS. Твоя аудитория поддерживает стрим своими нодами.**»

---

## 🔲 23. Pulsar GPT — встроенный AI-бот (#96)

Системный bot-аккаунт (как PulsarBot) c доступом к нескольким AI-моделям через внешний API-сервис (endpoint предоставит владелец). Монетизация — PLS или YooKassa, SUPER_ADMIN видит всё бесплатно.

### Возможности (главное меню)

Bot отображается в чат-листе. При первом открытии — приветствие + inline-кнопки:

| Кнопка | Действие |
|---|---|
| 💬 **Диалог с ИИ** | Открывает chat-thread, юзер пишет, бот отвечает. Модель выбирается в Profile → Settings (default: дешёвая) |
| 🎨 **Создать изображение** | Юзер вводит prompt → бот возвращает картинку. После генерации — кнопка «🎬 Оживить?» (передаёт результат в image-to-video flow) |
| 🎬 **Оживить фото** | Юзер аплоадит фото → бот возвращает анимированное видео. Модель в настройках |
| 🎥 **Видео из текста** | Text-to-video (Runway/Sora-style). Модель в настройках |
| 👤 **Профиль / настройки** | Picker-модели для каждой категории, баланс, история использования, кнопка «Пополнить» |
| 💳 **Оплата** | Выбор: списать с PLS-баланса или оплатить картой через YooKassa (RUB → пакет генераций) |

### Pricing-модель (черновая, тюнится по реальной cost)

| Действие | PLS | RUB через YooKassa |
|---|---|---|
| 1 chat-message (Haiku-tier) | 1 PLS | — (free до N в день после подписки) |
| 1 chat-message (Sonnet/Opus-tier) | 10 PLS | — |
| Image (1024×1024 SDXL/Flux) | 50 PLS | ~5 ₽ |
| Image animation (5 сек) | 200 PLS | ~20 ₽ |
| Text→video (5 сек 720p) | 500 PLS | ~50 ₽ |
| Text→video (15 сек 1080p HD-модель) | 2000 PLS | ~200 ₽ |

**Burn:** 10% от каждой PLS-цены → burn ledger. Когда оплата YooKassa — PLS не сжигается, конвертируется в выручку платформы.

**Подписки** (опциональные, для frequent users):
- **«Заряд»** 500 ₽/мес → 1000 PLS на баланс + −20% от всех цен
- **«Турбо»** 2000 ₽/мес → unlimited chat + 50 image/мес + 5 video/мес

### Ролевая логика

- **SUPER_ADMIN** (ты, брат) — все модели бесплатно, без лимитов. Технически: проверка `request.user.role === 'SUPER_ADMIN'` → пропускаем debit
- **Trusted/Official Merchant** (тиры мерчантов) — −10% от всех цен (бенефит за подписку)
- **Обычный юзер** — обычные цены

### Архитектура

```
POST /api/v1/pulsar-gpt/chat       Body: { message, model? }
POST /api/v1/pulsar-gpt/image      Body: { prompt, model?, size? }
POST /api/v1/pulsar-gpt/animate    Body: { imageUrl или imageId, model? }
POST /api/v1/pulsar-gpt/video      Body: { prompt, model?, duration?, hd? }
GET  /api/v1/pulsar-gpt/models     → список доступных моделей (cached)
GET  /api/v1/pulsar-gpt/usage      → история запросов + остаток
POST /api/v1/pulsar-gpt/topup      Body: { method: 'YOOKASSA' | 'PLS', amount }
```

Каждый endpoint:
1. Auth + rate-limit (10 req/min на юзера)
2. Если SUPER_ADMIN → пропускаем debit, идём в API
3. Иначе списываем PLS atomically → recordBurn(10%) → вызываем внешний API
4. На failure — refund 100% PLS обратно
5. Возвращаем результат + сохраняем в `PulsarGptRequest` для history

### Schema (Prisma)

```prisma
model PulsarGptRequest {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  type        String   @db.VarChar(16)   // 'chat' | 'image' | 'animate' | 'video'
  model       String   @db.VarChar(64)
  prompt      String?  @db.Text
  inputUrl    String?  // для animate
  outputUrl   String?  // S3 link
  pricePls    BigInt?
  priceRub    Decimal? @db.Decimal(10, 2)
  paymentMode String   @db.VarChar(8)    // 'PLS' | 'RUB' | 'ADMIN'
  status      String   @db.VarChar(16)   // 'PENDING' | 'DONE' | 'FAILED'
  errorMessage String? @db.VarChar(500)
  createdAt   DateTime @default(now())
  completedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt(sort: Desc)])
  @@map("pulsar_gpt_requests")
}

model PulsarGptUserSettings {
  userId       String @id @db.Uuid
  chatModel    String @default("haiku-4.5")
  imageModel   String @default("flux-schnell")
  animateModel String @default("svd-xt")
  videoModel   String @default("sora-mini")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("pulsar_gpt_settings")
}
```

### UI

- **В чате** с ботом — стандартное окно сообщений, но caret отключён (вход через inline-кнопки)
- **Главное меню** — `<InlineBotButtons>` (компонент уже есть!) с 4 действиями + Профиль
- **Image gen** — после ввода prompt бот шлёт «Генерирую…» → через 5-15 сек присылает картинку как attachment + кнопка «🎬 Оживить» под ней
- **Settings (профиль)** — отдельная модалка `<PulsarGptSettings>` с тремя model-picker'ами (chat/image/animate/video) + блок «Баланс: X PLS / Y кредитов» + кнопка «Пополнить»
- **History** — лента последних 50 запросов с миниатюрами картинок/видео и кнопкой «Скачать»

### Что из инфры уже готово ✅

- Bot system (PulsarBot pattern)
- Inline buttons (`InlineBotButtons` компонент)
- Attachments через `/api/v1/files/dl` (streaming с Range support — идеально для видео)
- PlsWallet + recordBurn для PLS-debit
- YooKassa integration (`yookassa.webhook.js`)
- File upload в MinIO/S3
- Auth + rate-limit middleware

### Что нужно от тебя 🟡

1. **API endpoint AI-сервиса** — URL, формат запроса/ответа, аутентификация (Bearer/API-key), список моделей и их цен
2. **Подтверждение pricing-модели** — цифры выше черновые, поправлю под реальные cost
3. **Подписки или нет на старте** — могу сделать сразу или отложить на v2

### MVP scope (3 дня после получения API)

- Day 1: schema, bot account создание, endpoints (без UI), тестирование chat + image вручную
- Day 2: UI — главное меню, chat-flow, image-gen-flow, image-animate-flow
- Day 3: video, settings, history, payment-flow для YooKassa

После запуска — анализ usage и тюнинг цен через первые 2 недели.

---

## 🔲 19a. IPFS/Arweave хранение (опционально)

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
