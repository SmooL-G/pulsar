import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import {
  ensureReferralCode,
  findUserByReferralCode,
  getReferralDashboard,
  signupTierBonus,
} from './referrals.service.js';
import { prisma } from '../../config/database.js';

export async function referralsRoutes(app: FastifyInstance) {
  // Public — no auth. Lets the signup form preview "you're getting the
  // X PLS tier bonus" before the user clicks register.
  app.get<{ Params: { code: string } }>(
    '/info/:code',
    async (request, reply) => {
      const code = request.params.code?.trim().toUpperCase();
      if (!code) return reply.status(400).send({ error: 'BAD_CODE' });
      const referrerId = await findUserByReferralCode(code);
      if (!referrerId) return reply.status(404).send({ error: 'NOT_FOUND' });

      const referrer = await prisma.user.findUnique({
        where: { id: referrerId },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      });
      // Predict the tier the new user would land in by counting
      // already-signed-up users + 1.
      const totalSoFar = await prisma.user.count();
      const yourTierBonus = signupTierBonus(totalSoFar + 1).toString();
      return {
        referrer: {
          id: referrer?.id,
          username: referrer?.username,
          displayName: referrer?.displayName,
          avatarUrl: referrer?.avatarUrl,
        },
        yourSignupRank: totalSoFar + 1,
        yourTierBonus,
      };
    },
  );

  // Authenticated routes
  app.register(async (authed) => {
    authed.addHook('onRequest', authMiddleware);

    /** My code, total referrals, earnings, recent ledger. */
    authed.get('/mine', async (request) => {
      return getReferralDashboard(request.user!.userId);
    });

    /** Force-create my code if it doesn't exist yet (legacy accounts). */
    authed.post('/code', async (request) => {
      const code = await ensureReferralCode(request.user!.userId);
      return { code };
    });
  });
}
