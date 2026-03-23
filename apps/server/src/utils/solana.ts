import { Keypair } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import crypto from 'crypto';

/**
 * Verify a Solana wallet signature
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Generate a new Solana keypair for custodial wallet
 */
export function generateKeypair(): { publicKey: string; secretKey: Uint8Array } {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: keypair.secretKey,
  };
}

/**
 * Encrypt a private key with user's password
 * Uses AES-256-GCM with PBKDF2 key derivation
 */
export function encryptPrivateKey(secretKey: Uint8Array, password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([cipher.update(secretKey), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: salt:iv:authTag:encrypted (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a private key with user's password
 */
export function decryptPrivateKey(encryptedData: string, password: string): Uint8Array {
  const [saltB64, ivB64, authTagB64, encryptedB64] = encryptedData.split(':');

  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return new Uint8Array(decrypted);
}

/**
 * Generate a random nonce for wallet authentication
 */
export function generateNonce(): string {
  return `Pulsar authentication nonce: ${crypto.randomUUID()}`;
}
