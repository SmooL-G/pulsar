import type { Server, Socket } from 'socket.io';
import { prisma } from '../../config/database.js';
import { getIO } from '../index.js';

/**
 * Voice/video call signaling — high-level lifecycle on top of the
 * raw webrtc:offer/answer/ice relay. Server is mostly a relay too,
 * but does three small things that don't belong on the client:
 *
 *   1. On `call:invite`, check whether the callee has any sockets
 *      connected. If not → emit `call:unavailable` back to the caller
 *      and write a "missed call" SYSTEM message into the DM.
 *   2. On `call:end`, write a SYSTEM message with the call duration
 *      so the DM shows "📞 1:23" (or "Rejected" / "Missed").
 *   3. Track active call ownership in-memory so a second `call:invite`
 *      while in-call returns `unavailable: busy` instead of letting
 *      both rings overlap.
 *
 * No DB model for Call yet — keeping it ephemeral for v1. Duration
 * comes from the client which is the only side that knows when both
 * peers were actually talking.
 */

interface ActiveCall {
  callId: string;
  caller: string;
  callee: string;
  kind: 'audio' | 'video';
  startedAt: number;
}

// In-memory: userId → active call (either as caller or callee).
// Cleared on call:end / call:cancel / call:reject / disconnect.
const userToCall = new Map<string, ActiveCall>();

function isUserOnline(userId: string): boolean {
  const io = getIO();
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(`user:${userId}`);
  return !!room && room.size > 0;
}

async function findDmId(userA: string, userB: string): Promise<string | null> {
  const dm = await prisma.chat.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { members: { some: { userId: userA, leftAt: null } } },
        { members: { some: { userId: userB, leftAt: null } } },
      ],
    },
    select: { id: true },
  });
  return dm?.id ?? null;
}

async function writeCallSystemMessage(opts: {
  dmId: string;
  senderId: string;
  status: 'answered' | 'missed' | 'rejected' | 'cancelled';
  kind: 'audio' | 'video';
  duration: number;
}) {
  const { dmId, senderId, status, kind, duration } = opts;
  const io = getIO();
  const msg = await prisma.message.create({
    data: {
      chatId: dmId,
      senderId,
      type: 'SYSTEM',
      content: null,
      metadata: {
        call: { status, kind, duration },
      },
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
  await prisma.chat.update({ where: { id: dmId }, data: { updatedAt: new Date() } });
  if (io) {
    io.to(`chat:${dmId}`).emit('message:new', {
      id: msg.id,
      chatId: dmId,
      senderId: msg.senderId,
      content: null,
      type: 'SYSTEM',
      replyToId: null,
      isEdited: false,
      isDeleted: false,
      metadata: msg.metadata as any,
      signature: null,
      signerWallet: null,
      encryptedContent: null,
      encryptionType: null,
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.updatedAt.toISOString(),
      sender: msg.sender,
      status: 'sent',
      attachments: [],
    } as any);
  }
}

export function registerCallHandlers(io: Server, socket: Socket) {
  const fromUserId = socket.data.userId as string;

  socket.on('call:invite', async (data: { to: string; callId: string; kind: 'audio' | 'video' }) => {
    if (!data?.to || !data.callId) return;
    const { to, callId, kind } = data;

    // Self-call guard.
    if (to === fromUserId) return;

    // Caller already in a call? Treat as race; just ignore.
    if (userToCall.has(fromUserId)) return;

    // Callee already in a call → busy.
    if (userToCall.has(to)) {
      socket.emit('call:unavailable', { callId, reason: 'busy' });
      return;
    }

    // Callee offline → unavailable + missed-call message.
    if (!isUserOnline(to)) {
      socket.emit('call:unavailable', { callId, reason: 'offline' });
      const dmId = await findDmId(fromUserId, to);
      if (dmId) {
        await writeCallSystemMessage({
          dmId, senderId: fromUserId, status: 'missed', kind, duration: 0,
        });
      }
      return;
    }

    const call: ActiveCall = {
      callId, caller: fromUserId, callee: to, kind, startedAt: Date.now(),
    };
    userToCall.set(fromUserId, call);
    userToCall.set(to, call);

    io.to(`user:${to}`).emit('call:incoming', { from: fromUserId, callId, kind });
    socket.emit('call:ringing', { callId });
  });

  socket.on('call:accept', (data: { to: string; callId: string }) => {
    if (!data?.to || !data.callId) return;
    const call = userToCall.get(fromUserId);
    if (!call || call.callId !== data.callId) return;
    // Reset startedAt to "actually connected" moment for duration calc.
    call.startedAt = Date.now();
    io.to(`user:${data.to}`).emit('call:accepted', { from: fromUserId, callId: data.callId });
  });

  socket.on('call:reject', async (data: { to: string; callId: string; reason?: 'declined' | 'busy' }) => {
    if (!data?.to || !data.callId) return;
    const call = userToCall.get(fromUserId);
    userToCall.delete(fromUserId);
    if (call) userToCall.delete(call.caller === fromUserId ? call.callee : call.caller);
    io.to(`user:${data.to}`).emit('call:rejected', {
      from: fromUserId, callId: data.callId, reason: data.reason,
    });
    if (call) {
      const dmId = await findDmId(call.caller, call.callee);
      if (dmId) {
        await writeCallSystemMessage({
          dmId, senderId: call.caller, status: 'rejected', kind: call.kind, duration: 0,
        });
      }
    }
  });

  socket.on('call:cancel', async (data: { to: string; callId: string }) => {
    if (!data?.to || !data.callId) return;
    const call = userToCall.get(fromUserId);
    userToCall.delete(fromUserId);
    if (call) userToCall.delete(call.caller === fromUserId ? call.callee : call.caller);
    io.to(`user:${data.to}`).emit('call:cancelled', { from: fromUserId, callId: data.callId });
    if (call) {
      const dmId = await findDmId(call.caller, call.callee);
      if (dmId) {
        await writeCallSystemMessage({
          dmId, senderId: call.caller, status: 'cancelled', kind: call.kind, duration: 0,
        });
      }
    }
  });

  socket.on('call:end', async (data: { to: string; callId: string; duration: number }) => {
    if (!data?.to || !data.callId) return;
    const call = userToCall.get(fromUserId);
    userToCall.delete(fromUserId);
    if (call) userToCall.delete(call.caller === fromUserId ? call.callee : call.caller);

    // Trust client duration but cap at 4h (sanity).
    const duration = Math.min(Math.max(0, Math.floor(data.duration || 0)), 4 * 60 * 60);
    io.to(`user:${data.to}`).emit('call:ended', {
      from: fromUserId, callId: data.callId, duration,
    });
    if (call && duration > 0) {
      const dmId = await findDmId(call.caller, call.callee);
      if (dmId) {
        await writeCallSystemMessage({
          dmId, senderId: call.caller, status: 'answered', kind: call.kind, duration,
        });
      }
    }
  });

  socket.on('disconnect', () => {
    // If user was in a call, notify peer and clean state.
    const call = userToCall.get(fromUserId);
    if (!call) return;
    const peer = call.caller === fromUserId ? call.callee : call.caller;
    userToCall.delete(fromUserId);
    userToCall.delete(peer);
    io.to(`user:${peer}`).emit('call:ended', {
      from: fromUserId, callId: call.callId, duration: 0,
    });
  });
}
