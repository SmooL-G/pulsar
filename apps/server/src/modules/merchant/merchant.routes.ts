import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import {
  submitApplication,
  approveApplication,
  rejectApplication,
  renewSubscription,
  revokeOfficial,
  recomputeTrustedTier,
  MerchantError,
  APPLICATION_FEE_PLS,
  ANNUAL_SUBSCRIPTION_PLS,
} from './merchant.service.js';
import { MerchantApplicationStatus } from '@prisma/client';

function handle<T>(reply: any, fn: () => Promise<T>) {
  return fn().catch((err: any) => {
    if (err instanceof MerchantError) return reply.status(400).send({ error: err.code, message: err.message });
    console.error('[merchant]', err);
    return reply.status(500).send({ error: 'INTERNAL', message: 'Server error' });
  });
}

export async function merchantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /merchant/me — own merchant status + latest application
  app.get('/me', async (request) => {
    const userId = request.user!.userId;
    const [user, latestApp] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { merchantTier: true, merchantExpiresAt: true, merchantSince: true, verificationLevel: true },
      }),
      prisma.merchantApplication.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      merchantTier: user?.merchantTier ?? 'NONE',
      merchantExpiresAt: user?.merchantExpiresAt?.toISOString() ?? null,
      merchantSince: user?.merchantSince?.toISOString() ?? null,
      verificationLevel: user?.verificationLevel ?? 0,
      pricing: {
        applicationFeePls: APPLICATION_FEE_PLS.toString(),
        annualSubscriptionPls: ANNUAL_SUBSCRIPTION_PLS.toString(),
      },
      latestApplication: latestApp ? {
        id: latestApp.id,
        status: latestApp.status,
        description: latestApp.description,
        contactInfo: latestApp.contactInfo,
        reviewNotes: latestApp.reviewNotes,
        createdAt: latestApp.createdAt.toISOString(),
        reviewedAt: latestApp.reviewedAt?.toISOString() ?? null,
      } : null,
    };
  });

  // POST /merchant/apply — submit application + pay fee
  app.post<{ Body: { description: string; contactInfo?: string } }>('/apply', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      const application = await submitApplication({
        userId,
        description: request.body.description,
        contactInfo: request.body.contactInfo,
      });
      return reply.status(201).send({ success: true, applicationId: application.id });
    }),
  );

  // POST /merchant/renew — pay for another year
  app.post('/renew', async (request, reply) =>
    handle(reply, async () => {
      const userId = request.user!.userId;
      const updated = await renewSubscription(userId);
      return { success: true, expiresAt: updated.merchantExpiresAt?.toISOString() };
    }),
  );

  // ─── Public read-only ─────────────────────────────────

  // GET /merchant/user/:userId — any user can see another's merchant tier
  app.get<{ Params: { userId: string } }>('/user/:userId', async (request) => {
    const u = await prisma.user.findUnique({
      where: { id: request.params.userId },
      select: { merchantTier: true, merchantSince: true, merchantExpiresAt: true },
    });
    if (!u) return { merchantTier: 'NONE' };
    // Hide expiresAt from public — only show that they're official.
    return {
      merchantTier: u.merchantTier,
      merchantSince: u.merchantSince?.toISOString() ?? null,
    };
  });

  // ─── Admin ─────────────────────────────────────────────

  app.register(async (admin) => {
    admin.addHook('preHandler', async (request, reply) => {
      if (request.user?.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'FORBIDDEN' });
      }
    });

    // GET /merchant/admin/applications?status=PENDING
    admin.get<{ Querystring: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' } }>('/admin/applications', async (request) => {
      const apps = await prisma.merchantApplication.findMany({
        where: request.query.status ? { status: request.query.status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true, verificationLevel: true, createdAt: true } },
          reviewer: { select: { username: true, displayName: true } },
        },
      });
      return {
        applications: apps.map((a) => ({
          id: a.id,
          status: a.status,
          description: a.description,
          contactInfo: a.contactInfo,
          applicationFeePls: a.applicationFeePls.toString(),
          createdAt: a.createdAt.toISOString(),
          reviewedAt: a.reviewedAt?.toISOString() ?? null,
          reviewNotes: a.reviewNotes,
          user: a.user,
          reviewer: a.reviewer,
        })),
      };
    });

    admin.post<{ Params: { id: string }; Body: { notes?: string } | undefined }>('/admin/applications/:id/approve', async (request, reply) =>
      handle(reply, async () => {
        await approveApplication({
          applicationId: request.params.id,
          reviewerId: request.user!.userId,
          notes: request.body?.notes,
        });
        return { success: true };
      }),
    );

    admin.post<{ Params: { id: string }; Body: { notes?: string } | undefined }>('/admin/applications/:id/reject', async (request, reply) =>
      handle(reply, async () => {
        await rejectApplication({
          applicationId: request.params.id,
          reviewerId: request.user!.userId,
          notes: request.body?.notes ?? 'No reason given',
        });
        return { success: true };
      }),
    );

    admin.post<{ Params: { userId: string } }>('/admin/revoke/:userId', async (request, reply) =>
      handle(reply, async () => {
        await revokeOfficial(request.params.userId);
        return { success: true };
      }),
    );

    // Manual trusted-tier recompute (debug / on-demand)
    admin.post<{ Params: { userId: string } }>('/admin/recompute/:userId', async (request, reply) =>
      handle(reply, async () => {
        const tier = await recomputeTrustedTier(request.params.userId);
        return { success: true, tier };
      }),
    );
  });
}
