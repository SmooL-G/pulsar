/**
 * E2E Key Manager — генерация и хранение ключей в IndexedDB.
 * Использует X25519 (через nacl.box.keyPair) для обмена ключами.
 */
import nacl from 'tweetnacl';
import { get, set, del } from 'idb-keyval';
import { api } from '../services/api';

const IDENTITY_KEY = 'pulsar:e2e:identityKey';
const PRE_KEY = 'pulsar:e2e:preKey';

export interface KeyPairData {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

function toBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

function fromBase64(str: string): Uint8Array {
  return new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
}

/**
 * Получить или сгенерировать identity keypair.
 */
export async function getIdentityKeyPair(): Promise<KeyPairData> {
  const stored = await get<string>(IDENTITY_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      publicKey: fromBase64(parsed.publicKey),
      secretKey: fromBase64(parsed.secretKey),
    };
  }

  const keyPair = nacl.box.keyPair();
  await set(IDENTITY_KEY, JSON.stringify({
    publicKey: toBase64(keyPair.publicKey),
    secretKey: toBase64(keyPair.secretKey),
  }));
  return keyPair;
}

/**
 * Получить или сгенерировать pre-key.
 */
export async function getPreKeyPair(): Promise<KeyPairData> {
  const stored = await get<string>(PRE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      publicKey: fromBase64(parsed.publicKey),
      secretKey: fromBase64(parsed.secretKey),
    };
  }

  const keyPair = nacl.box.keyPair();
  await set(PRE_KEY, JSON.stringify({
    publicKey: toBase64(keyPair.publicKey),
    secretKey: toBase64(keyPair.secretKey),
  }));
  return keyPair;
}

/**
 * Инициализация: сгенерировать ключи и загрузить на сервер.
 * Вызывается при первом входе или если ключей нет.
 */
export async function initializeE2EKeys(): Promise<void> {
  try {
    // Проверяем есть ли ключи на сервере
    const { data } = await api.get('/keys/my-bundle');
    if (data.hasBundle) {
      // Ключи уже загружены, проверяем что локальные есть
      const localIdentity = await get<string>(IDENTITY_KEY);
      if (localIdentity) return;
      // Локальных нет — нужно сгенерировать новые
    }

    const identityKP = await getIdentityKeyPair();
    const preKP = await getPreKeyPair();

    // Подписываем pre-key identity-ключом для верификации
    const signKeyPair = nacl.sign.keyPair.fromSeed(identityKP.secretKey.slice(0, 32));
    const preKeySignature = nacl.sign.detached(preKP.publicKey, signKeyPair.secretKey);

    await api.post('/keys/bundle', {
      identityKeyPub: toBase64(identityKP.publicKey),
      preKeyPub: toBase64(preKP.publicKey),
      preKeySignature: toBase64(preKeySignature),
    });
  } catch (err) {
    console.error('E2E key init error:', err);
  }
}

/**
 * Получить публичные ключи другого пользователя.
 */
export async function getRecipientKeys(userId: string): Promise<{
  identityKeyPub: Uint8Array;
  preKeyPub: Uint8Array;
} | null> {
  try {
    const { data } = await api.get(`/keys/bundle/${userId}`);
    return {
      identityKeyPub: fromBase64(data.bundle.identityKeyPub),
      preKeyPub: fromBase64(data.bundle.preKeyPub),
    };
  } catch {
    return null;
  }
}

/**
 * Удалить локальные ключи (при logout).
 */
export async function clearLocalKeys(): Promise<void> {
  await del(IDENTITY_KEY);
  await del(PRE_KEY);
}

// === Экспорт/Импорт ключей с шифрованием паролем (PBKDF2 + AES-GCM) ===

/**
 * Получить CryptoKey из пароля через PBKDF2.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Экспортировать ключи в зашифрованный JSON (пароль задаёт пользователь).
 * Возвращает строку JSON для скачивания.
 */
export async function exportKeys(password: string): Promise<string> {
  const identityRaw = await get<string>(IDENTITY_KEY);
  const preKeyRaw = await get<string>(PRE_KEY);

  if (!identityRaw || !preKeyRaw) {
    throw new Error('No keys to export');
  }

  const payload = JSON.stringify({ identity: identityRaw, preKey: preKeyRaw });
  const enc = new TextEncoder();
  const data = enc.encode(payload);

  // Генерируем salt и iv
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key, data,
  );

  return JSON.stringify({
    v: 1,
    alg: 'PBKDF2-AES-GCM',
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(encrypted)),
  });
}

/**
 * Импортировать ключи из зашифрованного JSON.
 * Дешифрует паролем и сохраняет в IndexedDB.
 */
export async function importKeys(fileContent: string, password: string): Promise<void> {
  const envelope = JSON.parse(fileContent);
  if (envelope.v !== 1 || envelope.alg !== 'PBKDF2-AES-GCM') {
    throw new Error('Unsupported key file format');
  }

  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const encData = fromBase64(envelope.data);

  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key, encData,
  );

  const dec = new TextDecoder();
  const payload = JSON.parse(dec.decode(decrypted));

  // Сохраняем в IndexedDB
  await set(IDENTITY_KEY, payload.identity);
  await set(PRE_KEY, payload.preKey);

  // Обновляем ключи на сервере
  const parsed = JSON.parse(payload.identity);
  const identityPub = fromBase64(parsed.publicKey);
  const identitySec = fromBase64(parsed.secretKey);
  const preParsed = JSON.parse(payload.preKey);
  const preKeyPub = fromBase64(preParsed.publicKey);

  const signKP = nacl.sign.keyPair.fromSeed(identitySec.slice(0, 32));
  const preKeySig = nacl.sign.detached(preKeyPub, signKP.secretKey);

  await api.post('/keys/bundle', {
    identityKeyPub: toBase64(identityPub),
    preKeyPub: toBase64(preKeyPub),
    preKeySignature: toBase64(preKeySig),
  });
}

/**
 * Проверить наличие локальных ключей.
 */
export async function hasLocalKeys(): Promise<boolean> {
  const identity = await get<string>(IDENTITY_KEY);
  return !!identity;
}

export { toBase64, fromBase64 };
