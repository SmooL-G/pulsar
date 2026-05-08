import type { FastifyInstance } from 'fastify';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/s3.js';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { nanoid } from 'nanoid';

// File size limits by verification level + Premium (bytes)
function getFileSizeLimit(verificationLevel: number, role: string, isPremium: boolean): number {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return 100 * 1024 * 1024;
  if (isPremium || verificationLevel >= 3) return 100 * 1024 * 1024;
  if (verificationLevel >= 1) return 50 * 1024 * 1024;
  return 20 * 1024 * 1024;
}

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Upload avatar
  app.post('/avatar', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'NO_FILE', message: 'No file uploaded' });
      }

      const ext = data.filename.split('.').pop()?.toLowerCase() || 'jpg';
      const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      if (!allowedExts.includes(ext)) {
        return reply.status(400).send({ error: 'INVALID_FILE', message: 'Only images are allowed' });
      }

      const key = `avatars/${request.user!.userId}/${nanoid()}.${ext}`;
      const buffer = await data.toBuffer();

      await s3Client.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: data.mimetype,
        })
      );

      const avatarUrl = env.S3_PUBLIC_URL
        ? `${env.S3_PUBLIC_URL}/${key}`
        : `/s3/${env.S3_BUCKET}/${key}`;
      return { avatarUrl };
    } catch (err: any) {
      console.error('Avatar upload error:', err.message || err);
      return reply.status(500).send({ error: 'UPLOAD_FAILED', message: err.message || 'Upload failed' });
    }
  });

  // Upload file (with per-user size limits)
  app.post('/file', async (request, reply) => {
    const userId = request.user!.userId;

    // Get user verification level + Premium status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        verificationLevel: true,
        role: true,
        subscription: { select: { expiresAt: true } },
      },
    });
    const isPremium = !!user?.subscription && user.subscription.expiresAt.getTime() > Date.now();
    const maxSize = getFileSizeLimit(user?.verificationLevel || 0, user?.role || 'USER', isPremium);
    const maxSizeMB = Math.round(maxSize / 1024 / 1024);

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'NO_FILE', message: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    if (buffer.length > maxSize) {
      return reply.status(413).send({
        error: 'FILE_TOO_LARGE',
        message: `File size exceeds ${maxSizeMB}MB limit. Upgrade verification to increase.`,
        maxSizeMB,
        verificationLevel: user?.verificationLevel || 0,
      });
    }

    const ext = data.filename.split('.').pop()?.toLowerCase() || 'bin';
    const key = `files/${userId}/${nanoid()}.${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: data.mimetype,
      })
    );

    // Streaming download endpoint instead of direct MinIO. Cloudflare /
    // Nginx kept timing out on slow connections (3MB files stalled at
    // ~50%); see modules/files/files.routes.ts for rationale.
    const url = `/api/v1/files/dl?k=${encodeURIComponent(key)}&n=${encodeURIComponent(data.filename)}`;
    return {
      url,
      fileName: data.filename,
      fileSize: buffer.length,
      mimeType: data.mimetype,
    };
  });
}
