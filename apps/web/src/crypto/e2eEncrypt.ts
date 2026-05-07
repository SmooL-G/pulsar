/**
 * E2E шифрование сообщений через NaCl box (X25519 + XSalsa20-Poly1305).
 *
 * Multi-device envelope formats:
 *
 *   v1 (legacy, single recipient device):
 *     base64(nonce(24) + ciphertext)
 *     — kept for back-compat with messages sent before linked-devices.
 *
 *   v2 (multi-device, current):
 *     JSON: {"v":2,"ct":{"<recipientPubB64>": "base64(nonce+ct)", ...}}
 *     — one entry per recipient device. Sender encrypts the same
 *       plaintext N times. Each device pulls out the entry whose key
 *       matches its own pubkey and decrypts that one.
 */
import nacl from 'tweetnacl';
import {
  getIdentityKeyPair,
  getLocalIdentityPubB64,
  getMyDevices,
  getRecipientDevices,
  getRecipientKeys,
  toBase64,
  fromBase64,
} from './keyManager';

interface EnvelopeV2 {
  v: 2;
  ct: Record<string, string>;
}

function isEnvelopeV2(value: unknown): value is EnvelopeV2 {
  return !!value && typeof value === 'object' && (value as any).v === 2 && typeof (value as any).ct === 'object';
}

function tryParseEnvelope(input: string): EnvelopeV2 | null {
  if (!input.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(input);
    return isEnvelopeV2(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Encrypts the plaintext once per recipient device, plus once for the
 * sender's own device so the sender can read their own messages back
 * across other linked sessions. Returns a JSON envelope or null if no
 * recipient device is registered.
 */
export async function encryptMessage(
  content: string,
  recipientUserId: string,
): Promise<string | null> {
  try {
    const myKeyPair = await getIdentityKeyPair();
    const myPubB64 = toBase64(myKeyPair.publicKey);

    const recipientDevices = await getRecipientDevices(recipientUserId);
    if (recipientDevices.length === 0) return null;

    // Encrypt for the sender's own pubkey too — without this, the
    // sender's other linked sessions (e.g. their phone) couldn't read
    // the messages they sent from desktop.
    const targets = new Map<string, string>(); // pub -> pub (dedup)
    for (const d of recipientDevices) targets.set(d.identityKeyPub, d.identityKeyPub);
    targets.set(myPubB64, myPubB64);

    // Sender's own *other* linked devices — so opening this DM on a
    // second browser/phone shows the messages I sent from here.
    try {
      const myDevices = await getMyDevices();
      for (const d of myDevices) targets.set(d.identityKeyPub, d.identityKeyPub);
    } catch { /* best effort */ }

    const messageBytes = new TextEncoder().encode(content);
    const ct: Record<string, string> = {};

    for (const recipientPubB64 of targets.keys()) {
      const recipientPub = fromBase64(recipientPubB64);
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const encrypted = nacl.box(messageBytes, nonce, recipientPub, myKeyPair.secretKey);
      if (!encrypted) continue;
      const combined = new Uint8Array(nonce.length + encrypted.length);
      combined.set(nonce);
      combined.set(encrypted, nonce.length);
      ct[recipientPubB64] = toBase64(combined);
    }

    if (Object.keys(ct).length === 0) return null;
    return JSON.stringify({ v: 2, ct } satisfies EnvelopeV2);
  } catch (err) {
    console.error('E2E encrypt error:', err);
    return null;
  }
}

/**
 * Decrypts an envelope (v2) or a legacy single-blob ciphertext (v1).
 * For v2: looks up the entry whose key equals this device's pubkey and
 * uses the sender's pubkey to authenticate. Returns null if no entry
 * is addressed to us (likely because this device wasn't yet registered
 * when the message was sent).
 */
export async function decryptMessage(
  encryptedInput: string,
  senderUserId: string,
): Promise<string | null> {
  try {
    const myKeyPair = await getIdentityKeyPair();

    // ─── v2 envelope path ──────────────────────────────────
    const envelope = tryParseEnvelope(encryptedInput);
    if (envelope) {
      const myPubB64 = await getLocalIdentityPubB64();
      if (!myPubB64) return null;
      const slice = envelope.ct[myPubB64];
      if (!slice) return null; // not addressed to this device
      const senderKeys = await getRecipientKeys(senderUserId);
      if (!senderKeys) return null;
      const combined = fromBase64(slice);
      const nonce = combined.slice(0, nacl.box.nonceLength);
      const ciphertext = combined.slice(nacl.box.nonceLength);
      const decrypted = nacl.box.open(
        ciphertext,
        nonce,
        senderKeys.identityKeyPub,
        myKeyPair.secretKey,
      );
      if (!decrypted) return null;
      return new TextDecoder().decode(decrypted);
    }

    // ─── v1 legacy path ────────────────────────────────────
    const senderKeys = await getRecipientKeys(senderUserId);
    if (!senderKeys) return null;
    const combined = fromBase64(encryptedInput);
    const nonce = combined.slice(0, nacl.box.nonceLength);
    const ciphertext = combined.slice(nacl.box.nonceLength);
    const decrypted = nacl.box.open(
      ciphertext,
      nonce,
      senderKeys.identityKeyPub,
      myKeyPair.secretKey,
    );
    if (!decrypted) return null;
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('E2E decrypt error:', err);
    return null;
  }
}
