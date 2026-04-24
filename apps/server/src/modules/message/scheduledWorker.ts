import { prisma } from '../../config/database.js';
import { getIO } from '../../socket/index.js';

const TICK_MS = 30_000;

const SENDER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  verificationLevel: true,
  profileBadge: true,
  nickColor: true,
  nftAvatarMint: true,
  role: true,
} as const;

/**
 * Background worker that materializes scheduled messages into real ones at
 * their `sendAt` time. Runs every TICK_MS; on each tick claims rows due
 * within the next tick and inside, and sends them in order. Each row is
 * deleted after a successful send so re-runs can't double-send.
 */
export function startScheduledMessagesWorker() {
  console.log('[ScheduledWorker] Started');

  const tick = async () => {
    try {
      // Slight overshoot (TICK_MS / 2 ahead) so we don't drift later than
      // the user's chosen time across tick boundaries.
      const cutoff = new Date(Date.now() + TICK_MS / 2);
      const due = await prisma.scheduledMessage.findMany({
        where: { sendAt: { lte: cutoff } },
        orderBy: { sendAt: 'asc' },
        take: 50,
      });
      if (due.length === 0) return;

      for (const sched of due) {
        try {
          // Verify sender is still in the chat. Skip + drop otherwise — common
          // case: user scheduled, then left the chat / chat was deleted.
          const member = await prisma.chatMember.findUnique({
            where: { chatId_userId: { chatId: sched.chatId, userId: sched.senderId } },
          });
          if (!member || member.leftAt) {
            await prisma.scheduledMessage.delete({ where: { id: sched.id } });
            continue;
          }

          const attachments = Array.isArray(sched.attachments) ? sched.attachments as any[] : [];
          const message = await prisma.message.create({
            data: {
              chatId: sched.chatId,
              senderId: sched.senderId,
              content: sched.content,
              type: sched.type,
              metadata: sched.metadata as any,
              ...(attachments.length > 0 && {
                attachments: {
                  create: attachments.map((a) => ({
                    uploaderId: sched.senderId,
                    fileName: a.fileName,
                    fileSize: BigInt(a.fileSize),
                    mimeType: a.mimeType,
                    s3Key: a.url,
                    s3Bucket: 'pulsar-files',
                  })),
                },
              }),
            },
            include: {
              sender: { select: SENDER_SELECT },
              attachments: {
                select: {
                  id: true, fileName: true, fileSize: true, mimeType: true,
                  s3Key: true, width: true, height: true,
                },
              },
            },
          });

          // Bump chat updatedAt so it pops to the top of recipients' lists.
          await prisma.chat.update({
            where: { id: sched.chatId },
            data: { updatedAt: new Date() },
          });

          await prisma.scheduledMessage.delete({ where: { id: sched.id } });

          const io = getIO();
          if (io) {
            io.to(`chat:${sched.chatId}`).emit('message:new', {
              id: message.id,
              chatId: message.chatId,
              senderId: message.senderId,
              content: message.content,
              type: message.type as any,
              replyToId: message.replyToId,
              isEdited: message.isEdited,
              isDeleted: message.isDeleted,
              metadata: message.metadata as any,
              signature: message.signature,
              signerWallet: message.signerWallet,
              encryptedContent: message.encryptedContent,
              encryptionType: message.encryptionType,
              commentsEnabled: message.commentsEnabled,
              commentChatId: message.commentChatId,
              createdAt: message.createdAt.toISOString(),
              updatedAt: message.updatedAt.toISOString(),
              sender: message.sender,
              attachments: (message.attachments || []).map((a: any) => ({
                id: a.id,
                fileName: a.fileName,
                fileSize: Number(a.fileSize),
                mimeType: a.mimeType,
                url: a.s3Key,
                width: a.width,
                height: a.height,
              })),
              status: 'sent',
            } as any);
          }
        } catch (err) {
          console.error('[ScheduledWorker] failed to send', sched.id, err);
        }
      }
    } catch (err) {
      console.error('[ScheduledWorker] tick error:', err);
    }
  };

  // Fire once shortly after boot to drain anything past-due, then on interval.
  setTimeout(tick, 5_000);
  setInterval(tick, TICK_MS);
}
