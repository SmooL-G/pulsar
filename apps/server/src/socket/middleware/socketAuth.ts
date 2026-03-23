import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import type { JwtPayload } from '../../middleware/auth.js';

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth.token as string | undefined;

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    socket.data.userId = payload.userId;
    socket.data.walletAddress = payload.walletAddress;
    socket.data.role = payload.role;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}
