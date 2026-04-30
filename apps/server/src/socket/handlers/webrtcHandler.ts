import type { Server, Socket } from 'socket.io';
import { redis } from '../../config/redis.js';

// Rate limit: at most this many signaling events per user per second.
// Pure relay; no DB hit. Generous because a real handshake fires
// 10-20 ICE candidates in a burst, plus one offer + one answer.
const RATE_PER_SECOND = 40;
const RATE_WINDOW_SEC = 1;

async function rateLimited(userId: string): Promise<boolean> {
  const key = `webrtc:rl:${userId}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, RATE_WINDOW_SEC);
  return n > RATE_PER_SECOND;
}

/**
 * Stateless signaling relay. We forward four event types between users
 * by pushing to the per-user Socket.IO room. The server inspects only
 * the routing field (`to`) — sdp/candidate are opaque.
 */
export function registerWebrtcHandlers(io: Server, socket: Socket) {
  const fromUserId = socket.data.userId as string;

  const relay = (event: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice' | 'webrtc:close') =>
    async (data: any) => {
      if (!data?.to || typeof data.to !== 'string') return;
      if (await rateLimited(fromUserId)) return;
      const { to, ...rest } = data;
      io.to(`user:${to}`).emit(event, { from: fromUserId, ...rest });
    };

  socket.on('webrtc:offer', relay('webrtc:offer'));
  socket.on('webrtc:answer', relay('webrtc:answer'));
  socket.on('webrtc:ice', relay('webrtc:ice'));
  socket.on('webrtc:close', relay('webrtc:close'));
}
