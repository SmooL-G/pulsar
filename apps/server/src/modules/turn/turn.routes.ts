import type { FastifyInstance } from 'fastify';
import { createHmac } from 'crypto';
import { authMiddleware } from '../../middleware/auth.js';
import { env } from '../../config/env.js';

/**
 * REST-API ephemeral credentials for coturn (RFC pattern 'turn-rest-api').
 *
 *   username = `${expiry_ts}:${stable_user_id}`
 *   password = base64( HMAC-SHA1(static_secret, username) )
 *
 * The TURN server validates the password against the same secret and
 * rejects the credential after `expiry_ts`. We don't expose the secret
 * to the client — they only see the freshly-signed pair.
 *
 * Each pair is good for 4 hours; a client that wants a longer call
 * just refetches as it nears expiry.
 */
const CREDENTIAL_TTL_SECONDS = 4 * 3600;

export async function turnRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  app.get('/credentials', async (request, reply) => {
    const secret = process.env.TURN_AUTH_SECRET || '';
    if (!secret) {
      return reply.status(503).send({ error: 'NOT_CONFIGURED' });
    }
    const userId = request.user!.userId;
    const expiry = Math.floor(Date.now() / 1000) + CREDENTIAL_TTL_SECONDS;
    const username = `${expiry}:${userId}`;
    const password = createHmac('sha1', secret).update(username).digest('base64');

    // urls list — what the browser passes into RTCPeerConnection.
    // We list both UDP+TCP+WSS so the worst-case (no UDP allowed)
    // still has a path. Hostname falls back to the env-configured one
    // if TURN_PUBLIC_HOST isn't set.
    const host = process.env.TURN_PUBLIC_HOST || env.CORS_ORIGIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const urls = [
      `turn:${host}:3478?transport=udp`,
      `turn:${host}:3478?transport=tcp`,
    ];

    return {
      username,
      credential: password,
      urls,
      ttl: CREDENTIAL_TTL_SECONDS,
    };
  });
}
