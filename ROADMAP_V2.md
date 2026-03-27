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
| 7 | P2P WebRTC | 🔲 В очереди | — |
| 8 | IPFS/Arweave хранение | 🔲 Опционально | — |

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

## 🔲 7. P2P WebRTC Data Channels (следующий)

Прямое P2P-соединение для DM между онлайн-пользователями. Сервер = signaling + fallback.

**Socket-события:**
```typescript
'webrtc:signal': { targetUserId: string; signal: RTCSignalData }
'webrtc:request': { targetUserId: string }
```

**Планируемые файлы:**
- `apps/web/src/p2p/peerManager.ts` — WebRTC соединения
- `apps/web/src/p2p/p2pMessageTransport.ts` — отправка через data channel с fallback
- `apps/server/src/socket/handlers/webrtcHandler.ts` — relay signaling

**Требования:** TURN-сервер для NAT traversal (coturn или Twilio).

---

## 🔲 8. IPFS/Arweave хранение (опционально)

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
