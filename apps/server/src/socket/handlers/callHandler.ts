import type { Server, Socket } from 'socket.io';
import { prisma } from '../../config/database.js';
import { getIO } from '../index.js';
import { sendPushToUser } from '../../modules/push/push.service.js';

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

/** Calls where the callee was offline at invite time. We send them a
 *  push notification and wait this long for them to come online. If
 *  they connect within the window, we promote pending → active and
 *  emit call:incoming. If not, caller gets call:unavailable. */
const PENDING_CALL_TTL_MS = 30_000;

interface PendingCall {
  callId: string;
  caller: string;
  callee: string;
  kind: 'audio' | 'video';
  startedAt: number;
  timeoutHandle: NodeJS.Timeout;
}

const pendingCalls = new Map<string, PendingCall>(); // callee → pending

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

    // Callee offline → register as pending, fire OS push, and wait up
    // to PENDING_CALL_TTL_MS for them to come online via the
    // notification. If they connect in time we promote to active and
    // ring them; otherwise the timeout writes a missed-call message.
    if (!isUserOnline(to)) {
      // Already a pending invite to this callee from someone else?
      // Tell the new caller they're busy.
      if (pendingCalls.has(to)) {
        socket.emit('call:unavailable', { callId, reason: 'busy' });
        return;
      }

      const caller = await prisma.user.findUnique({
        where: { id: fromUserId },
        select: { username: true, displayName: true },
      });
      const callerName = caller?.displayName || caller?.username || 'Someone';

      const timeoutHandle = setTimeout(async () => {
        const pending = pendingCalls.get(to);
        if (!pending || pending.callId !== callId) return;
        pendingCalls.delete(to);
        io.to(`user:${fromUserId}`).emit('call:unavailable', { callId, reason: 'offline' });
        const dmId = await findDmId(fromUserId, to);
        if (dmId) {
          await writeCallSystemMessage({
            dmId, senderId: fromUserId, status: 'missed', kind, duration: 0,
          });
        }
      }, PENDING_CALL_TTL_MS);

      pendingCalls.set(to, {
        callId, caller: fromUserId, callee: to, kind,
        startedAt: Date.now(), timeoutHandle,
      });

      // Tell the caller we're ringing (don't reveal callee is offline).
      socket.emit('call:ringing', { callId });

      // Fire push — fire-and-forget; do not block the socket response.
      sendPushToUser(to, {
        title: kind === 'video' ? `📹 Видеозвонок` : `📞 Звонок`,
        body: callerName,
        tag: `call:${callId}`,
        url: '/',
      }).catch((e) => console.warn('[call] push send failed:', e));
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

  // When a user connects (or reconnects), promote any pending call to
  // active and ring them. Runs synchronously on connect — fromUserId
  // is captured in the closure above.
  const pending = pendingCalls.get(fromUserId);
  if (pending) {
    clearTimeout(pending.timeoutHandle);
    pendingCalls.delete(fromUserId);
    // Check caller is still online and not in another call.
    if (isUserOnline(pending.caller) && !userToCall.has(pending.caller)) {
      const call: ActiveCall = {
        callId: pending.callId,
        caller: pending.caller,
        callee: pending.callee,
        kind: pending.kind,
        startedAt: pending.startedAt,
      };
      userToCall.set(pending.caller, call);
      userToCall.set(pending.callee, call);
      io.to(`user:${pending.callee}`).emit('call:incoming', {
        from: pending.caller, callId: pending.callId, kind: pending.kind,
      });
    } else {
      // Caller gave up. Write a missed-call message.
      findDmId(pending.caller, pending.callee).then((dmId) => {
        if (dmId) {
          writeCallSystemMessage({
            dmId, senderId: pending.caller, status: 'missed',
            kind: pending.kind, duration: 0,
          });
        }
      });
    }
  }

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

    // Also clear any pending invite this caller had to the target.
    const pending = pendingCalls.get(data.to);
    if (pending && pending.caller === fromUserId && pending.callId === data.callId) {
      clearTimeout(pending.timeoutHandle);
      pendingCalls.delete(data.to);
    }

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
