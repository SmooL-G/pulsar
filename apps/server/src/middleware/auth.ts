import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { ERROR_CODES } from '@pulsar/shared';

export interface JwtPayload {
  userId: string;
  walletAddress: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: ERROR_CODES.UNAUTHORIZED,
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Check session cache in Redis first
    const cached = await redis.get(`session:${token}`);
    if (cached) {
      request.user = JSON.parse(cached);
      return;
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, walletAddress: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return reply.status(401).send({
        error: ERROR_CODES.UNAUTHORIZED,
        message: 'User not found or inactive',
      });
    }

    request.user = {
      userId: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
    };

    // Cache session for 5 minutes
    await redis.setex(`session:${token}`, 300, JSON.stringify(request.user));
  } catch {
    return reply.status(401).send({
      error: ERROR_CODES.TOKEN_EXPIRED,
      message: 'Invalid or expired token',
    });
  }
}

export async function adminMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({
      error: ERROR_CODES.UNAUTHORIZED,
      message: 'Authentication required',
    });
  }

  if (request.user.role !== 'ADMIN' && request.user.role !== 'SUPER_ADMIN') {
    return reply.status(403).send({
      error: ERROR_CODES.FORBIDDEN,
      message: 'Admin access required',
    });
  }
}
