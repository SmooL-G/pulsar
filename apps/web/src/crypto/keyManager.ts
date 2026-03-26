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

export { toBase64, fromBase64 };
