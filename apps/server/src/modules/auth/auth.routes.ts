import type { FastifyInstance } from 'fastify';
import {
  handleRequestNonce,
  handleWalletVerify,
  handleRegister,
  handleLogin,
  handleRefreshToken,
  handleLogout,
  handleGetMe,
  handleForgotPassword,
  handleResetPassword,
} from './auth.controller.js';
import { authMiddleware } from '../../middleware/auth.js';

export async function authRoutes(app: FastifyInstance) {
  // Wallet auth
  app.post('/wallet/nonce', handleRequestNonce);
  app.post('/wallet/verify', handleWalletVerify);

  // Email auth
  app.post('/register', handleRegister);
  app.post('/login', handleLogin);

  // Token management
  app.post('/refresh', handleRefreshToken);
  app.post('/logout', handleLogout);

  // Password reset
  app.post('/forgot-password', handleForgotPassword);
  app.post('/reset-password', handleResetPassword);

  // Current user
  app.get('/me', { preHandler: [authMiddleware] }, handleGetMe);
}
