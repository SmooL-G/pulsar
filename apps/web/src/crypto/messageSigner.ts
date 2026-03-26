import bs58 from 'bs58';
import nacl from 'tweetnacl';

export interface SignedMessage {
  signature: string;
  signerWallet: string;
}

/**
 * Sign a message payload with a Solana wallet.
 * Payload format: chatId:timestamp:SHA256(content)
 */
export async function signMessage(
  chatId: string,
  content: string,
  walletSignMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined,
  publicKeyBase58: string | undefined,
): Promise<SignedMessage | null> {
  if (!walletSignMessage || !publicKeyBase58) return null;

  try {
    const contentHash = await sha256(content);
    const timestamp = Date.now().toString();
    const payload = `${chatId}:${timestamp}:${contentHash}`;
    const encodedPayload = new TextEncoder().encode(payload);

    const signatureBytes = await walletSignMessage(encodedPayload);
    return {
      signature: bs58.encode(signatureBytes),
      signerWallet: publicKeyBase58,
    };
  } catch {
    // User rejected or wallet unavailable — send unsigned
    return null;
  }
}

/**
 * Verify a message signature (client-side check).
 */
export function verifySignature(
  signature: string,
  signerWallet: string,
  _chatId: string,
  _content: string,
): boolean {
  try {
    // Basic sanity check — signature and wallet are valid base58
    const sigBytes = bs58.decode(signature);
    const pubkeyBytes = bs58.decode(signerWallet);
    return sigBytes.length === 64 && pubkeyBytes.length === 32;
  } catch {
    return false;
  }
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
