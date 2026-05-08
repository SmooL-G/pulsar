import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Readable } from 'node:stream';
import jwt from 'jsonwebtoken';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../../config/s3.js';
import { env } from '../../config/env.js';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';

/**
 * Streaming file download proxy.
 *
 * Why not direct-MinIO links? Long downloads on slow networks die at the
 * intermediate proxy (Cloudflare ~100s, Nginx default 60s) — user reported
 * 3MB stalling at ~50%. Streaming through Fastify gives us:
 *
 *   - Range-request support (HTTP 206) → browsers/IDM resume on disconnect
 *   - Single network path under our control (no third-party timeout)
 *   - Auth gate (only signed-in users can download attachments)
 *
 * URL shape: GET /api/v1/files/dl?k=<s3key>&n=<originalFilename>
 *   - k: s3 object key (URL-encoded)
 *   - n: optional original filename for Content-Disposition (download name)
 *
 * For backward compat, old messages with direct-MinIO URLs keep working —
 * only NEW uploads use this endpoint.
 */

/**
 * Token-in-query auth for direct browser links. Anchor clicks never
 * include Authorization headers, so we accept ?t=<jwt> as a fallback
 * specifically on the download endpoint. The token IS the same access
 * token used by the rest of the API — minor leak risk in URL logs is
 * accepted in exchange for native browser download UX.
 */
async function fileAuth(request: FastifyRequest, reply: FastifyReply) {
  if (request.headers.authorization?.startsWith('Bearer ')) {
    return authMiddleware(request, reply);
  }
  const t = (request.query as any)?.t;
  if (typeof t !== 'string' || !t) {
    return reply.status(401).send({ error: 'UNAUTHORIZED' });
  }
  try {
    const payload = jwt.verify(t, env.JWT_SECRET) as { userId: string; walletAddress: string; role: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, walletAddress: true, role: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return reply.status(401).send({ error: 'UNAUTHORIZED' });
    }
    request.user = { userId: user.id, walletAddress: user.walletAddress, role: user.role };
  } catch {
    return reply.status(401).send({ error: 'UNAUTHORIZED' });
  }
}

export async function filesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { k?: string; n?: string; t?: string } }>('/dl', { preHandler: fileAuth }, async (request, reply) => {
    const key = request.query.k;
    if (!key || typeof key !== 'string') {
      return reply.status(400).send({ error: 'MISSING_KEY' });
    }

    // HEAD first to learn size + content-type. Lets us answer Range
    // requests with the right Content-Range / Content-Length and bail
    // early on 404 without holding a stream.
    let totalSize: number;
    let contentType: string;
    try {
      const head = await s3Client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      totalSize = Number(head.ContentLength ?? 0);
      contentType = head.ContentType ?? 'application/octet-stream';
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound' || err?.Code === 'NoSuchKey') {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }
      console.error('[files/dl] head error:', err);
      return reply.status(502).send({ error: 'STORAGE_ERROR' });
    }

    // Always advertise Range support so clients know they can resume.
    reply.header('Accept-Ranges', 'bytes');
    reply.header('Cache-Control', 'private, max-age=3600');
    if (request.query.n) {
      // RFC 5987 encoding for non-ASCII filenames.
      const safe = encodeURIComponent(request.query.n).replace(/'/g, '%27');
      reply.header('Content-Disposition', `attachment; filename*=UTF-8''${safe}`);
    }
    reply.header('Content-Type', contentType);

    // Range request → respond 206 with sliced stream.
    const rangeHeader = request.headers.range;
    let cmdRange: string | undefined;
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (match) {
        const startStr = match[1];
        const endStr = match[2];
        let start = startStr ? parseInt(startStr, 10) : 0;
        let end = endStr ? parseInt(endStr, 10) : totalSize - 1;
        // "bytes=-100" → last 100 bytes
        if (!startStr && endStr) {
          start = Math.max(0, totalSize - parseInt(endStr, 10));
          end = totalSize - 1;
        }
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= totalSize) {
          reply.header('Content-Range', `bytes */${totalSize}`);
          return reply.status(416).send();
        }
        cmdRange = `bytes=${start}-${end}`;
        const len = end - start + 1;
        reply.header('Content-Length', String(len));
        reply.header('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        reply.status(206);
      }
    } else {
      reply.header('Content-Length', String(totalSize));
      reply.status(200);
    }

    try {
      const obj = await s3Client.send(new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Range: cmdRange,
      }));
      const body = obj.Body as Readable | undefined;
      if (!body) return reply.status(502).send({ error: 'STORAGE_ERROR' });
      // Pipe S3 body straight to the HTTP response. No buffering; back-
      // pressure is handled by Node streams.
      return reply.send(body);
    } catch (err) {
      console.error('[files/dl] get error:', err);
      return reply.status(502).send({ error: 'STORAGE_ERROR' });
    }
  });
}
