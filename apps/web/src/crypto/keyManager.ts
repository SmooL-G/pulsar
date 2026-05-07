/**
 * E2E Key Manager — генерация и хранение ключей в IndexedDB.
 * Использует X25519 (через nacl.box.keyPair) для обмена ключами.
 * Ключи привязаны к userId — не теряются при logout/login.
 */
import nacl from 'tweetnacl';
import { get, set } from 'idb-keyval';
import { api } from '../services/api';

// Текущий userId — устанавливается при initializeE2EKeys
let currentUserId: string | null = null;

function identityKey(uid?: string): string {
  const id = uid || currentUserId;
  return id ? `pulsar:e2e:identityKey:${id}` : 'pulsar:e2e:identityKey';
}

function preKey(uid?: string): string {
  const id = uid || currentUserId;
  return id ? `pulsar:e2e:preKey:${id}` : 'pulsar:e2e:preKey';
}

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
  const stored = await get<string>(identityKey());
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      publicKey: fromBase64(parsed.publicKey),
      secretKey: fromBase64(parsed.secretKey),
    };
  }

  const keyPair = nacl.box.keyPair();
  await set(identityKey(), JSON.stringify({
    publicKey: toBase64(keyPair.publicKey),
    secretKey: toBase64(keyPair.secretKey),
  }));
  return keyPair;
}

/**
 * Получить или сгенерировать pre-key.
 */
export async function getPreKeyPair(): Promise<KeyPairData> {
  const stored = await get<string>(preKey());
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      publicKey: fromBase64(parsed.publicKey),
      secretKey: fromBase64(parsed.secretKey),
    };
  }

  const keyPair = nacl.box.keyPair();
  await set(preKey(), JSON.stringify({
    publicKey: toBase64(keyPair.publicKey),
    secretKey: toBase64(keyPair.secretKey),
  }));
  return keyPair;
}

/** Heuristic device label so the Settings list reads as "Chrome on
 * Windows" instead of just a UUID. Best-effort — falls back to "Web". */
function detectDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Web';
  const ua = navigator.userAgent;
  let os = 'Web';
  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';
  return `${browser} on ${os}`;
}

/**
 * Инициализация: установить userId, сгенерировать ключи если нет, загрузить на сервер.
 * Каждый браузер/install регистрирует свою пару как отдельное устройство.
 * Ключи НЕ удаляются при logout — они привязаны к userId.
 */
export async function initializeE2EKeys(userId?: string): Promise<void> {
  try {
    if (userId) {
      currentUserId = userId;
    } else if (!currentUserId) {
      const { data } = await api.get('/auth/me');
      currentUserId = data.id;
    }

    const identityKP = await getIdentityKeyPair();
    const preKP = await getPreKeyPair();

    const localIdentityPubB64 = toBase64(identityKP.publicKey);
    const localPreKeyPubB64 = toBase64(preKP.publicKey);

    const signKeyPair = nacl.sign.keyPair.fromSeed(identityKP.secretKey.slice(0, 32));
    const preKeySignature = nacl.sign.detached(preKP.publicKey, signKeyPair.secretKey);

    // POST /keys/devices is idempotent on (userId, identityKeyPub) — safe
    // to call on every boot. Bumps lastSeenAt so dormant devices fall to
    // the bottom of the Settings list.
    await api.post('/keys/devices', {
      identityKeyPub: localIdentityPubB64,
      preKeyPub: localPreKeyPubB64,
      preKeySignature: toBase64(preKeySignature),
      deviceName: detectDeviceName(),
    });
    console.log('[e2e] Device registered/refreshed on server');
  } catch (err) {
    console.error('E2E key init error:', err);
  }
}

/** Returns this browser's identity public key (base64), null if not yet generated. */
export async function getLocalIdentityPubB64(): Promise<string | null> {
  const stored = await get<string>(identityKey());
  if (!stored) return null;
  try {
    return JSON.parse(stored).publicKey as string;
  } catch {
    return null;
  }
}

/**
 * Получить публичные ключи другого пользователя (legacy, single-device).
 * Used by callers that only need one bundle (Saved Messages decryption,
 * legacy code paths). New code should use getRecipientDevices().
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

export interface RecipientDevice {
  identityKeyPub: string;   // base64
  preKeyPub: string;        // base64
}

/**
 * Multi-device: returns every linked device's pubkey for a recipient.
 * Senders encrypt one ciphertext per device. Empty array means the
 * user has no E2E-capable devices (e.g. fresh account, no PWA install).
 */
export async function getRecipientDevices(userId: string): Promise<RecipientDevice[]> {
  try {
    const { data } = await api.get(`/keys/devices/${userId}`);
    return (data.devices ?? []).map((d: any) => ({
      identityKeyPub: d.identityKeyPub,
      preKeyPub: d.preKeyPub,
    }));
  } catch {
    return [];
  }
}

/**
 * Returns the current user's other linked devices (not just this one).
 * Senders include these when fanning out a ciphertext so the user can
 * read what they sent from any of their own sessions.
 */
export async function getMyDevices(): Promise<RecipientDevice[]> {
  try {
    const { data } = await api.get('/keys/my-devices');
    return (data.devices ?? []).map((d: any) => ({
      identityKeyPub: d.identityKeyPub,
      // /keys/my-devices doesn't expose preKeyPub (no need on the
      // settings UI); for fan-out we don't need it either — encryption
      // only uses identityKeyPub.
      preKeyPub: '',
    }));
  } catch {
    return [];
  }
}

/**
 * Установить currentUserId (вызывается при login без полной инициализации).
 */
export function setCurrentUserId(userId: string): void {
  currentUserId = userId;
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
 */
export async function exportKeys(password: string): Promise<string> {
  const identityRaw = await get<string>(identityKey());
  const preKeyRaw = await get<string>(preKey());

  if (!identityRaw || !preKeyRaw) {
    throw new Error('No keys to export');
  }

  const payload = JSON.stringify({ identity: identityRaw, preKey: preKeyRaw });
  const enc = new TextEncoder();
  const data = enc.encode(payload);

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

  // Сохраняем в IndexedDB (привязано к текущему userId)
  await set(identityKey(), payload.identity);
  await set(preKey(), payload.preKey);

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
  const identity = await get<string>(identityKey());
  return !!identity;
}

export { toBase64, fromBase64 };
