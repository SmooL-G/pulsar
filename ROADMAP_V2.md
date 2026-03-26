# Pulsar — Roadmap v2: Decentralization, NFT, Balance

## Context

Pulsar — крипто-мессенджер на Solana. Текущая архитектура полностью централизована: сообщения проходят через Socket.IO → PostgreSQL → broadcast. Есть реальная интеграция с Solana (депозит SOL → PLS, верификация транзакций on-chain), но нет P2P, нет E2E шифрования, нет NFT.

**Цели этого плана:**
1. Поэтапная децентрализация доставки сообщений
2. NFT интеграция (галерея + NFT как аватар)
3. Реал-тайм отображение баланса при пополнении

**Ответ на вопрос:** SOL при пополнении отправляется на `PLATFORM_WALLET_ADDRESS` (env-переменная). Если она пустая — депозиты не работают. Адрес, который видит пользователь — это его собственный кошелёк, не платформенный.

---

## Приоритеты реализации

| # | Фича | Сложность | Срок | Зависимости |
|---|-------|-----------|------|-------------|
| 1 | Реал-тайм баланс | Низкая | 1 неделя | — |
| 2 | NFT интеграция + аватар | Средняя | 2-3 недели | Helius API key |
| 3 | Подпись сообщений (Solana) | Средняя | 1-2 недели | — |
| 4 | E2E шифрование | Высокая | 3-4 недели | Фаза 3 |
| 5 | P2P WebRTC | Высокая | 3-4 недели | Фаза 4 + TURN сервер |
| 6 | IPFS/Arweave хранение | Опционально | 2-3 недели | Фазы 3-5 |

---

## 1. Реал-тайм баланс при пополнении

### Проблема
После депозита вызывается `fetchMe()` — полная перезагрузка пользователя. Нет прогресса между "tx отправлена" и "PLS зачислены". SOL-баланс не отображается.

### Решение

**Socket-события** (добавить в `socket-events.ts`):
```typescript
'wallet:balance-updated': {
  balance: string; change: string; type: 'DEPOSIT'|'PURCHASE'|'REWARD';
}
```

**Файлы:**

| Файл | Изменения |
|------|-----------|
| `packages/shared/src/types/socket-events.ts` | Добавить `wallet:balance-updated` |
| `apps/server/src/modules/wallet/wallet.routes.ts` | После deposit/purchase → `io.to(user:${id}).emit('wallet:balance-updated')` |
| `apps/web/src/hooks/useSocket.ts` | Слушать `wallet:balance-updated` → обновить user.plsBalance |
| `apps/web/src/components/wallet/DepositModal.tsx` | Многошаговый прогресс: Signing → Confirming → Crediting → Done |
| `apps/web/src/components/wallet/WalletPanel.tsx` | Показать SOL-баланс через `connection.getBalance()` |

### Отображение SOL-баланса
Для внешних кошельков — через wallet adapter `useConnection()`. Для кастодиальных — RPC запрос по `walletAddress`.

---

## 2. NFT интеграция + NFT как аватар

### Архитектурное решение
Использовать **Helius DAS API** вместо прямых on-chain вызовов Metaplex:
- Один HTTP-запрос vs множество RPC-вызовов на NFT
- Free tier достаточно для devnet и умеренного mainnet трафика
- Поле `nftAvatarMint` уже есть в схеме User (неиспользуемое)

### Схема БД

```prisma
model NftCache {
  id           String   @id @default(uuid()) @db.Uuid
  mintAddress  String   @unique @map("mint_address") @db.VarChar(64)
  ownerWallet  String   @map("owner_wallet") @db.VarChar(64)
  name         String?  @db.VarChar(128)
  imageUrl     String?  @map("image_url")
  collection   String?  @db.VarChar(64)
  lastVerified DateTime @default(now()) @map("last_verified")

  @@index([ownerWallet])
  @@map("nft_cache")
}
```

### Env-переменные
```
HELIUS_API_KEY=...
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
```

### API эндпоинты

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/nft/gallery` | NFT текущего пользователя (Redis-кэш 5 мин) |
| GET | `/nft/gallery/:wallet` | NFT любого пользователя (публичный) |
| POST | `/nft/set-avatar` | `{ mintAddress }` — проверить владение, установить |
| POST | `/nft/clear-avatar` | Убрать NFT-аватар |

### Файлы

**Создать:**

| Файл | Описание |
|------|----------|
| `apps/server/src/modules/nft/nft.routes.ts` | REST-эндпоинты |
| `apps/server/src/modules/nft/nft.service.ts` | Helius DAS API, кэширование, верификация |
| `apps/web/src/components/nft/NftGallery.tsx` | Грид-галерея NFT |
| `apps/web/src/components/nft/NftCard.tsx` | Карточка NFT |
| `apps/web/src/components/ui/NftAvatarBorder.tsx` | Спец-рамка для NFT-аватаров |

**Модифицировать:**

| Файл | Изменения |
|------|-----------|
| `apps/server/src/db/schema.prisma` | NftCache модель |
| `apps/server/src/app.ts` | Подключить /nft routes |
| `apps/server/src/config/env.ts` | HELIUS_API_KEY, HELIUS_RPC_URL |
| `apps/server/src/modules/user/user.routes.ts` | nftAvatarMint в select-запросах |
| `apps/web/src/components/profile/ProfilePanel.tsx` | Кнопка "NFT Аватар" + галерея |
| `apps/web/src/components/chat/MessageBubble.tsx` | NFT-рамка у аватара отправителя |

### Поток установки NFT-аватара
1. Пользователь открывает профиль → "NFT Аватар"
2. Запрос `GET /nft/gallery` → Helius `getAssetsByOwner`
3. Выбирает NFT → `POST /nft/set-avatar { mintAddress }`
4. Сервер проверяет владение через Helius `getAsset(mint)`
5. `User.nftAvatarMint = mint`, `User.avatarUrl = nft.imageUrl`
6. Рамка NFT-аватара определяется по `nftAvatarMint !== null`

### Периодическая проверка владения
- Cron-задача каждые 6 часов: проверить всех пользователей с `nftAvatarMint != null`
- Если NFT продан/передан → `nftAvatarMint = null`, уведомить пользователя

---

## 3. Децентрализация сообщений

### Фаза 3.1: Подпись сообщений (Solana wallet)

Каждое сообщение подписывается кошельком отправителя — криптографическое доказательство подлинности.

**Payload для подписи:** `${messageId}:${chatId}:${timestamp}:${SHA256(content)}`

**Схема — добавить в Message:**
```prisma
signature    String? @db.VarChar(128)
signerWallet String? @map("signer_wallet") @db.VarChar(64)
```

**Файлы:**

| Файл | Изменения |
|------|-----------|
| `apps/web/src/crypto/messageSigner.ts` | **Создать** — подпись через wallet adapter |
| `apps/web/src/crypto/messageVerifier.ts` | **Создать** — верификация подписей |
| `apps/server/src/socket/handlers/messageHandler.ts` | Принимать signature/signerWallet |
| `apps/web/src/components/chat/MessageBubble.tsx` | Иконка verified/unverified |
| `apps/web/src/components/chat/MessageInput.tsx` | Подпись перед отправкой |

**Внешние кошельки:** `wallet.signMessage()` из wallet-adapter.
**Кастодиальные:** Расшифровать приватный ключ клиентской стороне при логине (пароль → PBKDF2 → AES-GCM decrypt).

### Фаза 3.2: E2E шифрование

Сообщения шифруются на клиенте, сервер хранит шифротекст.

**Подход:** NaCl-box (X25519 + XSalsa20-Poly1305) — `tweetnacl` уже есть в проекте.

**Схема БД:**
```prisma
model UserKeyBundle {
  id             String @id @default(uuid()) @db.Uuid
  userId         String @unique @map("user_id") @db.Uuid
  identityKeyPub String @map("identity_key_pub")
  preKeyPub      String @map("pre_key_pub")
  preKeySignature String @map("pre_key_signature")

  user User @relation(...)
  @@map("user_key_bundles")
}
```

**Добавить в Message:**
```prisma
encryptedContent String? @map("encrypted_content") @db.Text
encryptionType   String? @map("encryption_type") @db.VarChar(32)
```

**Новые файлы:**
- `apps/web/src/crypto/keyManager.ts` — генерация/хранение ключей в IndexedDB
- `apps/web/src/crypto/e2eEncrypt.ts` — шифрование/дешифрование
- `apps/server/src/modules/keys/keys.routes.ts` — загрузка/получение public key bundles

**API:**
- `POST /keys/bundle` — загрузить свой ключ
- `GET /keys/bundle/:userId` — получить ключ другого пользователя

**Поток:**
1. При регистрации → генерация Ed25519 identity keypair + X25519 pre-key → IndexedDB
2. Публичные части → `POST /keys/bundle`
3. Перед первым сообщением → `GET /keys/bundle/:userId` → X25519 DH → shared secret
4. Шифрование `nacl.secretbox(content, nonce, sharedSecret)`
5. Сервер хранит `encryptedContent`, `content = null`

### Фаза 3.3: P2P WebRTC Data Channels

Прямое P2P-соединение для DM между онлайн-пользователями. Сервер = signaling + fallback.

**Socket-события:**
```typescript
'webrtc:signal': { targetUserId: string; signal: RTCSignalData }
'webrtc:request': { targetUserId: string }
```

**Новые файлы:**
- `apps/web/src/p2p/peerManager.ts` — WebRTC соединения
- `apps/web/src/p2p/p2pMessageTransport.ts` — отправка через data channel с fallback
- `apps/server/src/socket/handlers/webrtcHandler.ts` — relay signaling

**Требования:** TURN-сервер для NAT traversal (coturn или Twilio).

### Фаза 3.4: IPFS/Arweave (долгосрочно, опционально)

Зашифрованные сообщения хранятся на IPFS/Arweave для перманентного децентрализованного хранения. CID/tx ID сохраняется в metadata сообщения.

**Не рекомендуется как приоритет** — дорого, сложно, PostgreSQL с бэкапами надёжнее.

---

## Зависимости для установки

| Фаза | Пакет | Куда |
|------|-------|------|
| 2 (NFT) | — (fetch API) | server |
| 3.1 (Подпись) | — (tweetnacl есть) | — |
| 3.2 (E2E) | `idb-keyval`, `tweetnacl-util` | web |
| 3.3 (P2P) | `simple-peer` (опционально) | web |

---

## Верификация

### Фича 1 (Баланс):
- Пополнить 0.01 SOL на devnet → PLS баланс обновляется в реальном времени без перезагрузки
- Проверить socket-событие при покупке верификации/бейджа/reward от админа
- Открыть 2 вкладки — баланс синхронизируется

### Фича 2 (NFT):
- Заминтить NFT на devnet через Sugar CLI
- Галерея загружается, NFT можно установить как аватар
- Аватар отображается со спец-рамкой в чате
- Передать NFT другому кошельку → через 6ч аватар сбросится

### Фича 3 (Децентрализация):
- Подпись: отправить сообщение → в БД есть signature → UI показывает ✓ verified
- E2E: сообщения в БД зашифрованы, plaintext виден только участникам чата
- P2P: два онлайн-пользователя → data channel открыт → сообщения идут напрямую, при отключении → fallback на Socket.IO
