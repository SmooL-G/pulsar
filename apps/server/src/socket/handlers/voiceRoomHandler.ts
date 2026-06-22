import type { Server, Socket } from 'socket.io';
import { prisma } from '../../config/database.js';
import { getIO } from '../index.js';
import { sendPushToUsers } from '../../modules/push/push.service.js';

/**
 * Group voice rooms — per-chat mesh P2P audio with optional admin-
 * gated video. State is in-memory only (no DB model) — a room exists
 * while ≥1 participant is in it and disappears when the last person
 * leaves.
 *
 * Roles:
 *   - Any chat member can join as a listener/talker (audio always on).
 *   - OWNER/ADMIN/MODERATOR can grant video to any participant.
 *   - Granted participants can start/stop their camera (capped to
 *     MAX_VIDEO_BROADCASTERS simultaneous broadcasters to fit mesh
 *     bandwidth budget).
 */

const MAX_ROOM_SIZE = 12;
const MAX_VIDEO_BROADCASTERS = 2;

type Role = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
const ADMIN_ROLES: Role[] = ['OWNER', 'ADMIN', 'MODERATOR'];

interface Participant {
  userId: string;
  socketIds: Set<string>;
  isMuted: boolean;
  canStreamVideo: boolean;
  isStreamingVideo: boolean;
  joinedAt: number;
}

interface VoiceRoom {
  chatId: string;
  participants: Map<string, Participant>; // userId → participant
}

const rooms = new Map<string, VoiceRoom>(); // chatId → room

function serializeParticipants(room: VoiceRoom) {
  return Array.from(room.participants.values()).map((p) => ({
    userId: p.userId,
    isMuted: p.isMuted,
    canStreamVideo: p.canStreamVideo,
    isStreamingVideo: p.isStreamingVideo,
    joinedAt: p.joinedAt,
  }));
}

async function isChatMember(userId: string, chatId: string): Promise<{ isMember: boolean; role: Role | null }> {
  const m = await prisma.chatMember.findFirst({
    where: { userId, chatId, leftAt: null },
    select: { role: true },
  });
  if (!m) return { isMember: false, role: null };
  return { isMember: true, role: m.role as Role };
}

async function writeVoiceRoomSystemMessage(opts: {
  chatId: string;
  starterId: string;
}) {
  const io = getIO();
  const msg = await prisma.message.create({
    data: {
      chatId: opts.chatId,
      senderId: opts.starterId,
      type: 'SYSTEM',
      content: null,
      metadata: { voiceRoom: { event: 'opened' } },
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
  await prisma.chat.update({ where: { id: opts.chatId }, data: { updatedAt: new Date() } });
  if (io) {
    io.to(`chat:${opts.chatId}`).emit('message:new', {
      id: msg.id,
      chatId: opts.chatId,
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

async function pushOthers(chatId: string, starterId: string, starterName: string) {
  try {
    const members = await prisma.chatMember.findMany({
      where: { chatId, leftAt: null, userId: { not: starterId } },
      select: { userId: true },
    });
    if (members.length === 0) return;
    await sendPushToUsers(members.map((m) => m.userId), {
      title: '🎤 Голосовой чат',
      body: `${starterName} открыл голосовую комнату`,
      tag: `voiceRoom:${chatId}`,
      url: '/',
    });
  } catch (e) {
    console.warn('[voiceRoom] push failed:', e);
  }
}

export function registerVoiceRoomHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on('voiceRoom:join', async ({ chatId }) => {
    if (!chatId) return;
    const { isMember } = await isChatMember(userId, chatId);
    if (!isMember) {
      socket.emit('voiceRoom:error', { chatId, code: 'FORBIDDEN' });
      return;
    }

    let room = rooms.get(chatId);
    const isNewRoom = !room;
    if (!room) {
      room = { chatId, participants: new Map() };
      rooms.set(chatId, room);
    }

    if (room.participants.size >= MAX_ROOM_SIZE && !room.participants.has(userId)) {
      socket.emit('voiceRoom:error', { chatId, code: 'FULL' });
      if (isNewRoom) rooms.delete(chatId);
      return;
    }

    let participant = room.participants.get(userId);
    if (!participant) {
      participant = {
        userId,
        socketIds: new Set([socket.id]),
        isMuted: false,
        canStreamVideo: false,
        isStreamingVideo: false,
        joinedAt: Date.now(),
      };
      room.participants.set(userId, participant);
    } else {
      // Same user joined from another tab/device — track socket but
      // don't duplicate participant entry.
      participant.socketIds.add(socket.id);
    }

    // Join the Socket.IO room for this voice room so we can broadcast.
    socket.join(`voiceRoom:${chatId}`);

    // Tell the joining socket the full participant list.
    socket.emit('voiceRoom:participants', {
      chatId, participants: serializeParticipants(room),
    });
    // Tell others someone new arrived.
    socket.to(`voiceRoom:${chatId}`).emit('voiceRoom:participantJoined', {
      chatId, userId,
    });

    // If this is the first participant, write a SYSTEM message in the
    // group chat + push the other chat members so they see the room.
    if (isNewRoom) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, displayName: true },
      });
      const starterName = user?.displayName || user?.username || 'Кто-то';
      void writeVoiceRoomSystemMessage({ chatId, starterId: userId });
      void pushOthers(chatId, userId, starterName);
    }
  });

  socket.on('voiceRoom:leave', ({ chatId }) => {
    if (!chatId) return;
    handleLeave(chatId, userId, socket.id);
  });

  socket.on('voiceRoom:mute', ({ chatId, isMuted }) => {
    const room = rooms.get(chatId);
    const p = room?.participants.get(userId);
    if (!p) return;
    p.isMuted = !!isMuted;
    io.to(`voiceRoom:${chatId}`).emit('voiceRoom:participantMuted', {
      chatId, userId, isMuted: p.isMuted,
    });
  });

  socket.on('voiceRoom:videoRequest', async ({ chatId }) => {
    const room = rooms.get(chatId);
    const p = room?.participants.get(userId);
    if (!p || !room) return;
    if (p.canStreamVideo) return; // Already granted.

    // Notify admins in the room.
    const adminIds: string[] = [];
    for (const [otherId] of room.participants) {
      if (otherId === userId) continue;
      const { role } = await isChatMember(otherId, chatId);
      if (role && ADMIN_ROLES.includes(role)) adminIds.push(otherId);
    }
    for (const adminId of adminIds) {
      io.to(`user:${adminId}`).emit('voiceRoom:videoRequest', { chatId, userId });
    }
  });

  socket.on('voiceRoom:videoGrant', async ({ chatId, targetUserId, allowed }) => {
    const room = rooms.get(chatId);
    if (!room) return;
    const { role } = await isChatMember(userId, chatId);
    if (!role || !ADMIN_ROLES.includes(role)) {
      socket.emit('voiceRoom:error', { chatId, code: 'FORBIDDEN' });
      return;
    }
    const target = room.participants.get(targetUserId);
    if (!target) return;
    target.canStreamVideo = !!allowed;
    if (!allowed && target.isStreamingVideo) {
      target.isStreamingVideo = false;
      io.to(`voiceRoom:${chatId}`).emit('voiceRoom:videoStopped', { chatId, userId: targetUserId });
    }
    io.to(`voiceRoom:${chatId}`).emit('voiceRoom:videoGranted', {
      chatId, userId: targetUserId, allowed: !!allowed,
    });
  });

  socket.on('voiceRoom:videoStart', ({ chatId }) => {
    const room = rooms.get(chatId);
    const p = room?.participants.get(userId);
    if (!p || !room) return;
    if (!p.canStreamVideo) {
      socket.emit('voiceRoom:error', { chatId, code: 'NOT_ALLOWED' });
      return;
    }
    const active = Array.from(room.participants.values()).filter((x) => x.isStreamingVideo).length;
    if (!p.isStreamingVideo && active >= MAX_VIDEO_BROADCASTERS) {
      socket.emit('voiceRoom:error', { chatId, code: 'VIDEO_LIMIT' });
      return;
    }
    p.isStreamingVideo = true;
    io.to(`voiceRoom:${chatId}`).emit('voiceRoom:videoStarted', { chatId, userId });
  });

  socket.on('voiceRoom:videoStop', ({ chatId }) => {
    const room = rooms.get(chatId);
    const p = room?.participants.get(userId);
    if (!p || !room) return;
    if (!p.isStreamingVideo) return;
    p.isStreamingVideo = false;
    io.to(`voiceRoom:${chatId}`).emit('voiceRoom:videoStopped', { chatId, userId });
  });

  socket.on('disconnect', () => {
    // Find every room this socket was in and clean up.
    for (const [chatId, room] of rooms) {
      const p = room.participants.get(userId);
      if (!p) continue;
      if (p.socketIds.has(socket.id)) {
        p.socketIds.delete(socket.id);
        if (p.socketIds.size === 0) {
          handleLeave(chatId, userId, socket.id);
        }
      }
    }
  });
}

function handleLeave(chatId: string, userId: string, socketId: string) {
  const io = getIO();
  const room = rooms.get(chatId);
  if (!room) return;
  const p = room.participants.get(userId);
  if (!p) return;
  p.socketIds.delete(socketId);
  // If this user has other sockets still in the room (other tab),
  // don't remove the participant.
  if (p.socketIds.size > 0) return;

  room.participants.delete(userId);
  io.to(`voiceRoom:${chatId}`).emit('voiceRoom:participantLeft', { chatId, userId });

  if (room.participants.size === 0) {
    rooms.delete(chatId);
    io.to(`chat:${chatId}`).emit('voiceRoom:closed', { chatId });
  }
}

/** Read-only snapshot for HTTP route — lets a chat list show
 *  active-room badges without holding a socket. */
export function getActiveVoiceRoom(chatId: string) {
  const room = rooms.get(chatId);
  if (!room) return null;
  return {
    chatId,
    participants: serializeParticipants(room),
  };
}
