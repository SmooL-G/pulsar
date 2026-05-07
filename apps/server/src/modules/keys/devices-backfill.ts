import { prisma } from '../../config/database.js';

/**
 * One-shot migration that copies every UserKeyBundle row into a
 * matching UserDevice (if one doesn't already exist). Without this,
 * users who registered their keypair before the multi-device rollout
 * would have zero linked devices and nobody could send them an
 * encrypted message.
 *
 * Idempotent — runs every server boot and skips users who already
 * have at least one device row.
 */
export async function backfillDevicesFromBundles(): Promise<void> {
  const bundles = await prisma.userKeyBundle.findMany({
    select: {
      userId: true,
      identityKeyPub: true,
      preKeyPub: true,
      preKeySignature: true,
      createdAt: true,
    },
  });

  let created = 0;
  for (const b of bundles) {
    const existing = await prisma.userDevice.findUnique({
      where: { userId_identityKeyPub: { userId: b.userId, identityKeyPub: b.identityKeyPub } },
    });
    if (existing) continue;
    await prisma.userDevice.create({
      data: {
        userId: b.userId,
        identityKeyPub: b.identityKeyPub,
        preKeyPub: b.preKeyPub,
        preKeySignature: b.preKeySignature,
        deviceName: 'Original device',
        createdAt: b.createdAt,
        lastSeenAt: b.createdAt,
      },
    });
    created++;
  }

  if (created > 0) {
    console.log(`[devices-backfill] migrated ${created} bundle(s) to UserDevice`);
  }
}
