import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { getIO } from '../../socket/index.js';

export async function chatRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // List user's chats
  app.get('/', async (request) => {
    const userId = request.user!.userId;

    const memberships = await prisma.chatMember.findMany({
      where: { userId, leftAt: null },
      include: {
        chat: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: { username: true, displayName: true, verificationLevel: true, profileBadge: true, nickColor: true, avatarFrame: true, bubbleColor: true, role: true },
                },
              },
            },
            members: {
              where: { leftAt: null },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    isOnline: true,
                    verificationLevel: true,
                    profileBadge: true,
                    nickColor: true,
                    avatarFrame: true,
                    bubbleColor: true,
                    socialLinks: true,
                    bio: true,
                    lastSeenAt: true,
                    walletAddress: true,
                    createdAt: true,
                    isBot: true,
                    role: true,
                    subscription: { select: { expiresAt: true } },
                  },
                },
              },
            },
            _count: { select: { members: { where: { leftAt: null } } } },
          },
        },
      },
      orderBy: { chat: { updatedAt: 'desc' } },
    });

    const flattenPremium = (u: any) => {
      if (!u) return u;
      const isPremium = !!u.subscription && new Date(u.subscription.expiresAt).getTime() > Date.now();
      const { subscription: _drop, ...rest } = u;
      return { ...rest, isPremium };
    };

    // Per-chat unread count: messages newer than the user's most-recent
    // ReadReceipt for this chat (or, if they've never read anything,
    // newer than the moment they joined). Computed in parallel here so
    // the chat list survives a page refresh — previously unreadCount
    // only existed in client memory and reset to 0 on reload.
    const unreadCounts = await Promise.all(memberships.map(async (m) => {
      const lastRead = await prisma.readReceipt.findFirst({
        where: { userId, message: { chatId: m.chatId } },
        orderBy: { readAt: 'desc' },
        select: { readAt: true },
      });
      const floor = lastRead?.readAt ?? m.joinedAt;
      const count = await prisma.message.count({
        where: {
          chatId: m.chatId,
          NOT: { senderId: userId },
          createdAt: { gt: floor },
        },
      });
      return [m.chatId, count] as const;
    }));
    const unreadByChat = new Map(unreadCounts);

    const chats = memberships.map((m) => {
      const lastMessage = m.chat.messages[0];
      return {
        id: m.chat.id,
        type: m.chat.type,
        name: m.chat.name,
        avatarUrl: m.chat.avatarUrl,
        isPublic: m.chat.isPublic,
        inviteCode: m.chat.inviteCode,
        ownerId: m.chat.ownerId,
        memberCount: m.chat._count.members,
        myRole: m.role,
        muted: !!m.mutedUntil,
        updatedAt: m.chat.updatedAt.toISOString(),
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              type: lastMessage.type,
              createdAt: lastMessage.createdAt.toISOString(),
              sender: lastMessage.sender,
            }
          : null,
        members: m.chat.members.map((mem: any) => ({ ...mem, user: flattenPremium(mem.user) })),
        otherUser:
          m.chat.type === 'DIRECT'
            ? flattenPremium(m.chat.members.find((member) => member.userId !== userId)?.user)
            : null,
        unreadCount: unreadByChat.get(m.chatId) ?? 0,
      };
    });

    return { chats };
  });

  // Delete / leave chat
  app.delete<{ Params: { chatId: string } }>('/:chatId', async (request, reply) => {
    const userId = request.user!.userId;
    const { chatId } = request.params;

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership || membership.leftAt) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Chat not found' });
    }

    const chat = await prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Chat not found' });
    }

    if (chat.type === 'DIRECT') {
      // For DMs: leave (soft delete)
      await prisma.chatMember.update({
        where: { id: membership.id },
        data: { leftAt: new Date() },
      });
    } else if (chat.type === 'GROUP') {
      if (chat.ownerId === userId) {
        // Owner deletes entire group
        await prisma.$transaction([
          prisma.readReceipt.deleteMany({ where: { message: { chatId } } }),
          prisma.reaction.deleteMany({ where: { message: { chatId } } }),
          prisma.fileAttachment.deleteMany({ where: { message: { chatId } } }),
          prisma.message.deleteMany({ where: { chatId } }),
          prisma.chatMember.deleteMany({ where: { chatId } }),
          prisma.chat.delete({ where: { id: chatId } }),
        ]);
      } else {
        // Member leaves group
        await prisma.chatMember.update({
          where: { id: membership.id },
          data: { leftAt: new Date() },
        });
      }
    }

    return { success: true };
  });

  // Clear chat history (for current user)
  app.delete<{ Params: { chatId: string } }>('/:chatId/messages', async (request, reply) => {
    const userId = request.user!.userId;
    const { chatId } = request.params;

    const membership = await prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!membership || membership.leftAt) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Chat not found' });
    }

    // Delete all messages in this chat sent by this user
    // For now, clear all messages (full clear)
    await prisma.$transaction([
      prisma.readReceipt.deleteMany({ where: { message: { chatId } } }),
      prisma.reaction.deleteMany({ where: { message: { chatId } } }),
      prisma.fileAttachment.deleteMany({ where: { message: { chatId } } }),
      prisma.message.deleteMany({ where: { chatId } }),
    ]);

    return { success: true };
  });

  // Create or get DM chat
  app.post('/direct', async (request, reply) => {
    const userId = request.user!.userId;
    const { targetUserId } = request.body as { targetUserId: string };

    if (userId === targetUserId) {
      return reply.status(400).send({ error: 'INVALID_REQUEST', message: 'Cannot chat with yourself' });
    }

    // Check if DM already exists between these users
    const existing = await prisma.chat.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { members: { some: { userId, leftAt: null } } },
          { members: { some: { userId: targetUserId, leftAt: null } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isOnline: true,
                verificationLevel: true,
                profileBadge: true,
                nickColor: true,
                avatarFrame: true,
                bubbleColor: true,
                socialLinks: true,
                isBot: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (existing) {
      const otherUser = existing.members.find((m) => m.userId !== userId)?.user;
      return { chat: { ...existing, otherUser } };
    }

    // Create new DM
    const chat = await prisma.chat.create({
      data: {
        type: 'DIRECT',
        members: {
          create: [
            { userId, role: 'MEMBER' },
            { userId: targetUserId, role: 'MEMBER' },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                isOnline: true,
                verificationLevel: true,
                profileBadge: true,
                nickColor: true,
                avatarFrame: true,
                bubbleColor: true,
                socialLinks: true,
                isBot: true,
                role: true,
              },
            },
          },
        },
      },
    });

    const otherUser = chat.members.find((m) => m.userId !== userId)?.user;
    return reply.status(201).send({ chat: { ...chat, otherUser } });
  });

  // Get or lazy-create the user's Saved Messages chat
  app.get('/saved', async (request) => {
    const userId = request.user!.userId;

    let chat = await prisma.chat.findFirst({
      where: {
        type: 'SAVED',
        members: { some: { userId, leftAt: null } },
      },
    });

    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          type: 'SAVED',
          ownerId: userId,
          members: { create: [{ userId, role: 'OWNER' }] },
        },
      });
    }

    return { chat };
  });

  // Edit group profile — owner-only. Updates name / description /
  // avatarUrl in any combination; unspecified fields are left alone.
  app.patch<{
    Params: { chatId: string };
    Body: { name?: string; description?: string | null; avatarUrl?: string | null };
  }>(
    '/:chatId/group',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { chatId } = request.params;
      const { name, description, avatarUrl } = request.body || {};

      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: { id: true, type: true, ownerId: true },
      });
      if (!chat) return reply.status(404).send({ error: 'NOT_FOUND' });
      if (chat.type !== 'GROUP' && chat.type !== 'CHANNEL') {
        return reply.status(400).send({ error: 'NOT_A_GROUP' });
      }
      if (chat.ownerId !== userId) {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only owner can edit' });
      }

      const data: Record<string, unknown> = {};
      if (typeof name === 'string') {
        const trimmed = name.trim();
        if (trimmed.length < 1 || trimmed.length > 64) {
          return reply.status(400).send({ error: 'INVALID_NAME', message: '1-64 chars' });
        }
        data.name = trimmed;
      }
      if (description !== undefined) {
        if (description !== null && description.length > 512) {
          return reply.status(400).send({ error: 'INVALID_DESCRIPTION', message: 'max 512 chars' });
        }
        data.description = description || null;
      }
      if (avatarUrl !== undefined) {
        if (avatarUrl !== null && (typeof avatarUrl !== 'string' || avatarUrl.length > 1024)) {
          return reply.status(400).send({ error: 'INVALID_AVATAR' });
        }
        data.avatarUrl = avatarUrl || null;
      }
      if (Object.keys(data).length === 0) return { ok: true, chat };

      const updated = await prisma.chat.update({
        where: { id: chatId },
        data,
        select: { id: true, name: true, description: true, avatarUrl: true },
      });

      // Broadcast so other members' UIs update live.
      const io = getIO();
      io?.to(`chat:${chatId}`).emit('chat:updated', { chatId, ...updated });

      return { ok: true, chat: updated };
    },
  );

  // Mute / unmute chat
  app.patch<{ Params: { chatId: string }; Body: { muted: boolean } }>(
    '/:chatId/mute',
    async (request, reply) => {
      const userId = request.user!.userId;
      const { chatId } = request.params;
      const { muted } = request.body as { muted: boolean };

      const membership = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId, userId } },
      });
      if (!membership || membership.leftAt) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }

      await prisma.chatMember.update({
        where: { id: membership.id },
        data: { mutedUntil: muted ? new Date('2099-12-31') : null },
      });

      return { success: true, muted };
    }
  );
}
