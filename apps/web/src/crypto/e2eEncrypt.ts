/**
 * E2E шифрование сообщений через NaCl box (X25519 + XSalsa20-Poly1305).
 *
 * Формат зашифрованного сообщения (base64):
 * nonce (24 bytes) + ciphertext
 */
import nacl from 'tweetnacl';
import { getIdentityKeyPair, getRecipientKeys, toBase64, fromBase64 } from './keyManager';

/**
 * Зашифровать сообщение для получателя.
 * Возвращает base64-строку или null если шифрование невозможно.
 */
export async function encryptMessage(
  content: string,
  recipientUserId: string,
): Promise<string | null> {
  try {
    const recipientKeys = await getRecipientKeys(recipientUserId);
    if (!recipientKeys) return null; // у получателя нет ключей

    const myKeyPair = await getIdentityKeyPair();
    const messageBytes = new TextEncoder().encode(content);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);

    const encrypted = nacl.box(
      messageBytes,
      nonce,
      recipientKeys.identityKeyPub,
      myKeyPair.secretKey,
    );

    if (!encrypted) return null;

    // nonce + ciphertext → base64
    const combined = new Uint8Array(nonce.length + encrypted.length);
    combined.set(nonce);
    combined.set(encrypted, nonce.length);

    return toBase64(combined);
  } catch (err) {
    console.error('E2E encrypt error:', err);
    return null;
  }
}

/**
 * Дешифровать сообщение от отправителя.
 */
export async function decryptMessage(
  encryptedBase64: string,
  senderUserId: string,
): Promise<string | null> {
  try {
    const senderKeys = await getRecipientKeys(senderUserId);
    if (!senderKeys) return null;

    const myKeyPair = await getIdentityKeyPair();
    const combined = fromBase64(encryptedBase64);

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
