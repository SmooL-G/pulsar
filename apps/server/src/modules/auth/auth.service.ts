import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import {
  verifySignature,
  generateKeypair,
  encryptPrivateKey,
  generateNonce,
} from '../../utils/solana.js';
import { ERROR_CODES } from '@pulsar/shared';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';
const NONCE_TTL = 300; // 5 minutes

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate nonce for wallet authentication
 */
export async function requestNonce(walletAddress: string): Promise<string> {
  const nonce = generateNonce();
  await redis.setex(`nonce:${walletAddress}`, NONCE_TTL, nonce);
  return nonce;
}

/**
 * Verify wallet signature and authenticate/register user
 */
export async function verifyWalletAuth(
  walletAddress: string,
  signature: string,
  username?: string
): Promise<{ tokens: TokenPair; isNewUser: boolean }> {
  // Get stored nonce
  const nonce = await redis.get(`nonce:${walletAddress}`);
  if (!nonce) {
    throw createError(401, ERROR_CODES.INVALID_SIGNATURE, 'Nonce expired or not found');
  }

  // Verify signature
  const isValid = verifySignature(nonce, signature, walletAddress);
  if (!isValid) {
    throw createError(401, ERROR_CODES.INVALID_SIGNATURE, 'Invalid signature');
  }

  // Delete used nonce
  await redis.del(`nonce:${walletAddress}`);

  // Find or create user
  let user = await prisma.user.findUnique({ where: { walletAddress } });
  let isNewUser = false;

  if (!user) {
    if (!username) {
      // Generate a default username from wallet address
      username = `user_${walletAddress.slice(0, 8)}`;
    }

    // Check username availability
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      username = `${username}_${Date.now().toString(36)}`;
    }

    user = await prisma.user.create({
      data: {
        walletAddress,
        walletType: 'EXTERNAL',
        username,
      },
    });
    isNewUser = true;
  }

  if (user.status !== 'ACTIVE') {
    throw createError(403, ERROR_CODES.USER_BANNED, 'Account is suspended or banned');
  }

  const tokens = await generateTokens(user.id, user.walletAddress, user.role);

  return { tokens, isNewUser };
}

/**
 * Register with email/password and auto-generate a Solana wallet
 */
export async function registerWithEmail(
  username: string,
  email: string,
  password: string,
  displayName?: string
): Promise<{ tokens: TokenPair; walletAddress: string }> {
  // Email is case-insensitive in practice — store and compare in lowercase
  email = email.trim().toLowerCase();

  // Check uniqueness
  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    throw createError(409, ERROR_CODES.USERNAME_TAKEN, 'Username is already taken');
  }

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) {
    throw createError(409, ERROR_CODES.EMAIL_TAKEN, 'Email is already registered');
  }

  // Generate Solana keypair
  const { publicKey, secretKey } = generateKeypair();

  // Encrypt private key with user's password
  const encryptedPrivateKey = encryptPrivateKey(secretKey, password);

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      walletAddress: publicKey,
      walletType: 'CUSTODIAL',
      encryptedPrivateKey,
      email,
      passwordHash,
      username,
      displayName,
    },
  });

  const tokens = await generateTokens(user.id, user.walletAddress, user.role);

  return { tokens, walletAddress: publicKey };
}

/**
 * Login with email/password
 */
export async function loginWithEmail(
  emailOrUsername: string,
  password: string
): Promise<TokenPair> {
  const ident = emailOrUsername.trim();
  // Email contains @, username is bare alphanumeric. Match accordingly so
  // a username like "elite@2" doesn't collide with a real email lookup.
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ident);
  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: ident.toLowerCase() } })
    : await prisma.user.findFirst({
        where: { username: { equals: ident, mode: 'insensitive' } },
      });

  if (!user || !user.passwordHash) {
    throw createError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid credentials');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw createError(401, ERROR_CODES.INVALID_CREDENTIALS, 'Invalid credentials');
  }

  if (user.status !== 'ACTIVE') {
    throw createError(403, ERROR_CODES.USER_BANNED, 'Account is suspended or banned');
  }

  return generateTokens(user.id, user.walletAddress, user.role);
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      userId: string;
      sessionId: string;
    };

    // Check session exists
    const session = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: { select: { id: true, walletAddress: true, role: true, status: true } } },
    });

    if (!session || session.expiresAt < new Date()) {
      throw createError(401, ERROR_CODES.TOKEN_EXPIRED, 'Session expired');
    }

    if (session.user.status !== 'ACTIVE') {
      throw createError(403, ERROR_CODES.USER_BANNED, 'Account is suspended');
    }

    // Rotate refresh token — delete old session, create new one
    await prisma.session.delete({ where: { id: session.id } });

    return generateTokens(session.user.id, session.user.walletAddress, session.user.role);
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    throw createError(401, ERROR_CODES.TOKEN_EXPIRED, 'Invalid refresh token');
  }
}

/**
 * Logout — invalidate session
 */
export async function logout(refreshToken: string): Promise<void> {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as {
      sessionId: string;
    };
    await prisma.session.delete({ where: { id: payload.sessionId } });
  } catch {
    // Ignore invalid tokens during logout
  }
}

// ─── Helpers ─────────────────────────────────────────────

async function generateTokens(
  userId: string,
  walletAddress: string,
  role: string
): Promise<TokenPair> {
  // Create session record
  const session = await prisma.session.create({
    data: {
      userId,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  const accessToken = jwt.sign(
    { userId, walletAddress, role },
    env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId, sessionId: session.id },
    env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

function createError(statusCode: number, code: string, message: string) {
  const error = new Error(message) as Error & { statusCode: number; code: string };
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
