import type { FastifyInstance } from 'fastify';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/s3.js';
import { authMiddleware } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import { nanoid } from 'nanoid';

export async function uploadRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Upload avatar
  app.post('/avatar', async (request, reply) => {
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

    // URL accessible through nginx proxy
    const avatarUrl = `/s3/${env.S3_BUCKET}/${key}`;

    return { avatarUrl };
  });
}
