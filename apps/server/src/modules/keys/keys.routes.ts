import type { FastifyInstance } from 'fastify';
import { prisma } from '../../config/database.js';
import { authMiddleware } from '../../middleware/auth.js';

export async function keysRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);

  // ─── Linked devices (multi-device E2E) ────────────────────
  // Each browser/install registers its keypair as a UserDevice row.
  // Senders fetch all of a recipient's devices and encrypt one copy
  // per device. The legacy /bundle endpoints below are kept for old
  // clients (they map to the user's primary/most-recent device).

  // POST /keys/devices — register or refresh the current device
  app.post<{
    Body: {
      identityKeyPub: string;
      preKeyPub: string;
      preKeySignature: string;
      deviceName?: string;
    };
  }>('/devices', async (request, reply) => {
    const { identityKeyPub, preKeyPub, preKeySignature, deviceName } = request.body;
    if (!identityKeyPub || !preKeyPub || !preKeySignature) {
      return reply.status(400).send({ error: 'MISSING_KEYS' });
    }
    const userId = request.user!.userId;
    const trimmedName = deviceName?.slice(0, 64) ?? null;

    const device = await prisma.userDevice.upsert({
      where: { userId_identityKeyPub: { userId, identityKeyPub } },
      create: { userId, identityKeyPub, preKeyPub, preKeySignature, deviceName: trimmedName },
      update: {
        preKeyPub,
        preKeySignature,
        // Refresh deviceName only if a non-empty value was supplied —
        // never overwrite an existing label with null.
        ...(trimmedName ? { deviceName: trimmedName } : {}),
        lastSeenAt: new Date(),
      },
    });

    // Mirror to the legacy single-bundle table so older clients that
    // still call /bundle/:userId see *some* key (the one this device
    // just registered with) instead of nothing. Best-effort.
    await prisma.userKeyBundle.upsert({
      where: { userId },
      create: { userId, identityKeyPub, preKeyPub, preKeySignature },
      update: { identityKeyPub, preKeyPub, preKeySignature },
    });

    return {
      success: true,
      device: {
        id: device.id,
        identityKeyPub: device.identityKeyPub,
        preKeyPub: device.preKeyPub,
        deviceName: device.deviceName,
        createdAt: device.createdAt.toISOString(),
        lastSeenAt: device.lastSeenAt.toISOString(),
      },
    };
  });

  // GET /keys/devices/:userId — list a user's active devices (for senders)
  app.get<{ Params: { userId: string } }>('/devices/:userId', async (request) => {
    const devices = await prisma.userDevice.findMany({
      where: { userId: request.params.userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        identityKeyPub: true,
        preKeyPub: true,
        preKeySignature: true,
        deviceName: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });
    return {
      devices: devices.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        lastSeenAt: d.lastSeenAt.toISOString(),
      })),
    };
  });

  // GET /keys/my-devices — list current user's devices (for the Settings UI)
  app.get('/my-devices', async (request) => {
    const userId = request.user!.userId;
    const devices = await prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        identityKeyPub: true,
        deviceName: true,
        createdAt: true,
        lastSeenAt: true,
      },
    });
    return {
      devices: devices.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        lastSeenAt: d.lastSeenAt.toISOString(),
      })),
    };
  });

  // DELETE /keys/devices/:id — revoke a device (must own it)
  app.delete<{ Params: { id: string } }>('/devices/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const device = await prisma.userDevice.findUnique({ where: { id: request.params.id } });
    if (!device || device.userId !== userId) {
      return reply.status(404).send({ error: 'NOT_FOUND' });
    }
    await prisma.userDevice.delete({ where: { id: device.id } });
    return { success: true };
  });

  // ─── Legacy single-bundle endpoints (kept for old clients) ─────────

  // POST /keys/bundle — legacy upsert. Also writes a UserDevice so the
  // user is visible to multi-device-aware senders.
  app.post<{
    Body: { identityKeyPub: string; preKeyPub: string; preKeySignature: string };
  }>('/bundle', async (request, reply) => {
    const { identityKeyPub, preKeyPub, preKeySignature } = request.body;
    if (!identityKeyPub || !preKeyPub || !preKeySignature) {
      return reply.status(400).send({ error: 'MISSING_KEYS' });
    }
    const userId = request.user!.userId;

    const bundle = await prisma.userKeyBundle.upsert({
      where: { userId },
      create: { userId, identityKeyPub, preKeyPub, preKeySignature },
      update: { identityKeyPub, preKeyPub, preKeySignature },
    });
    await prisma.userDevice.upsert({
      where: { userId_identityKeyPub: { userId, identityKeyPub } },
      create: { userId, identityKeyPub, preKeyPub, preKeySignature },
      update: { preKeyPub, preKeySignature, lastSeenAt: new Date() },
    });

    return { success: true, bundle: { id: bundle.id, identityKeyPub: bundle.identityKeyPub, preKeyPub: bundle.preKeyPub } };
  });

  // GET /keys/bundle/:userId — legacy: returns *one* device for back-compat.
  // Multi-device-aware clients should use /keys/devices/:userId instead.
  app.get<{ Params: { userId: string } }>('/bundle/:userId', async (request, reply) => {
    const device = await prisma.userDevice.findFirst({
      where: { userId: request.params.userId },
      orderBy: { lastSeenAt: 'desc' },
      select: { identityKeyPub: true, preKeyPub: true, preKeySignature: true },
    });
    // Fall back to the old user_key_bundles row if no device exists yet
    // (covers the brief window before backfill migration runs).
    const bundle = device ?? await prisma.userKeyBundle.findUnique({
      where: { userId: request.params.userId },
      select: { identityKeyPub: true, preKeyPub: true, preKeySignature: true },
    });
    if (!bundle) {
      return reply.status(404).send({ error: 'NO_KEY_BUNDLE' });
    }
    return { bundle };
  });

  // GET /keys/my-bundle — used by client init to detect re-sync needs
  app.get('/my-bundle', async (request) => {
    const bundle = await prisma.userKeyBundle.findUnique({
      where: { userId: request.user!.userId },
      select: { identityKeyPub: true, preKeyPub: true, createdAt: true },
    });
    return { hasBundle: !!bundle, bundle };
  });
}
