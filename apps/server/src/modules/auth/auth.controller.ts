import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  requestNonce,
  verifyWalletAuth,
  registerWithEmail,
  loginWithEmail,
  refreshAccessToken,
  logout,
} from './auth.service.js';
import { registerSchema, walletAuthSchema } from '@pulsar/shared';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const nonceSchema = z.object({
  walletAddress: z.string().min(32).max(44),
});

const walletVerifySchema = z.object({
  walletAddress: z.string().min(32).max(44),
  signature: z.string(),
  username: z.string().optional(),
});

export async function handleRequestNonce(request: FastifyRequest, reply: FastifyReply) {
  const { walletAddress } = nonceSchema.parse(request.body);
  const nonce = await requestNonce(walletAddress);
  return reply.send({ nonce });
}

export async function handleWalletVerify(request: FastifyRequest, reply: FastifyReply) {
  const { walletAddress, signature, username } = walletVerifySchema.parse(request.body);
  const { tokens, isNewUser } = await verifyWalletAuth(walletAddress, signature, username);

  // Set refresh token as HttpOnly cookie
  reply.setCookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return reply.send({
    accessToken: tokens.accessToken,
    isNewUser,
  });
}

export async function handleRegister(request: FastifyRequest, reply: FastifyReply) {
  const data = registerSchema.parse(request.body);

  if (!data.email || !data.password) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Email and password are required for registration',
    });
  }

  const { tokens, walletAddress } = await registerWithEmail(
    data.username,
    data.email,
    data.password,
    data.displayName
  );

  reply.setCookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60,
  });

  return reply.status(201).send({
    accessToken: tokens.accessToken,
    walletAddress,
  });
}

export async function handleLogin(request: FastifyRequest, reply: FastifyReply) {
  const { email, password } = loginSchema.parse(request.body);
  const tokens = await loginWithEmail(email, password);

  reply.setCookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60,
  });

  return reply.send({ accessToken: tokens.accessToken });
}

export async function handleRefreshToken(request: FastifyRequest, reply: FastifyReply) {
  const refreshToken = request.cookies.refreshToken;
  if (!refreshToken) {
    return reply.status(401).send({ error: 'TOKEN_EXPIRED', message: 'No refresh token' });
  }

  const tokens = await refreshAccessToken(refreshToken);

  reply.setCookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60,
  });

  return reply.send({ accessToken: tokens.accessToken });
}

export async function handleLogout(request: FastifyRequest, reply: FastifyReply) {
  const refreshToken = request.cookies.refreshToken;
  if (refreshToken) {
    await logout(refreshToken);
  }

  reply.clearCookie('refreshToken', { path: '/api/v1/auth' });
  return reply.send({ success: true });
}

export async function handleGetMe(request: FastifyRequest, reply: FastifyReply) {
  const { prisma } = await import('../../config/database.js');

  const user = await prisma.user.findUnique({
    where: { id: request.user!.userId },
    select: {
      id: true,
      walletAddress: true,
      walletType: true,
      email: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      role: true,
      status: true,
      isOnline: true,
      createdAt: true,
    },
  });

  if (!user) {
    return reply.status(404).send({ error: 'USER_NOT_FOUND', message: 'User not found' });
  }

  return reply.send(user);
}
