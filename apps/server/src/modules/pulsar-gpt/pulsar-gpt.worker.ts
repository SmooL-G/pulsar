import { prisma } from '../../config/database.js';
import { PulsarGptStatus } from '@prisma/client';
import { getTaskInfo } from './kie.client.js';
import { getIO } from '../../socket/index.js';
import { PULSAR_GPT_BOT_USER_ID } from './pulsar-gpt.seed.js';

/**
 * Polls KIE.AI for the status of every PENDING async task we've launched.
 *
 * For each pending request:
 *   - success → save outputUrl, mark DONE
 *   - failed  → mark FAILED, refund the user's PLS (atomic)
 *   - still running → leave alone
 *
 * Runs every TICK_MS (5s). Cheap because most tasks finish within
 * 30-120 seconds and we keep polling time short by skipping rows older
 * than MAX_AGE_MIN (treated as TIMEOUT failures and refunded).
 */

const TICK_MS = 5_000;
const MAX_AGE_MIN = 15;       // older than this → auto-fail + refund

export function startPulsarGptWorker() {
  const tick = async () => {
    try {
      const cutoff = new Date(Date.now() - MAX_AGE_MIN * 60 * 1000);
      const pending = await prisma.pulsarGptRequest.findMany({
        where: { status: PulsarGptStatus.PENDING, kieTaskId: { not: null } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      for (const req of pending) {
        // Auto-timeout requests stuck > MAX_AGE_MIN. Refund + mark FAILED.
        if (req.createdAt < cutoff) {
          await refundAndFail(req.id, req.userId, req.pricePls, 'Timed out (>15min)');
          continue;
        }
        try {
          const info = await getTaskInfo(req.kieTaskId!);
          if (info.state === 'success' && info.resultUrls.length > 0) {
            await prisma.pulsarGptRequest.update({
              where: { id: req.id },
              data: {
                status: PulsarGptStatus.DONE,
                outputUrl: info.resultUrls[0],
                completedAt: new Date(),
              },
            });
            // If this request was triggered from a bot DM, post the
            // result back into that chat as a bot message with the
            // url + a follow-up "Ещё?" button.
            if (req.postToChatId && PULSAR_GPT_BOT_USER_ID) {
              try {
                await postBotResult(req.postToChatId, req.type, info.resultUrls[0], req.prompt);
              } catch (e) {
                console.warn('[pulsar-gpt-worker] post to chat failed', e);
              }
            }
          } else if (info.state === 'failed') {
            await refundAndFail(req.id, req.userId, req.pricePls, info.errorMessage || 'KIE task failed');
            if (req.postToChatId && PULSAR_GPT_BOT_USER_ID) {
              try {
                await postBotResult(req.postToChatId, 'FAILED', '', `❌ Не получилось — деньги вернулись.\n${info.errorMessage || ''}`);
              } catch { /* ignore */ }
            }
          }
          // else still pending/running — leave for next tick
        } catch (err: any) {
          // Transient KIE error — log and try again next tick
          console.warn('[pulsar-gpt-worker] poll error for', req.id, err?.message);
        }
      }
    } catch (err) {
      console.error('[pulsar-gpt-worker] tick failed:', err);
    }
  };
  setTimeout(tick, 7_000);
  setInterval(tick, TICK_MS);
}

/** Post a generation result back into the chat as a bot message. The
 *  message is plain text with the URL — chat client renders image/video
 *  by URL extension. Includes a follow-up nudge with /menu hint. */
async function postBotResult(chatId: string, type: string, resultUrl: string, prompt: string | null) {
  const promptHint = prompt ? `«${prompt.slice(0, 80)}${prompt.length > 80 ? '…' : ''}»\n\n` : '';
  const labels: Record<string, string> = {
    IMAGE: '🎨 Готово',
    ANIMATE: '🎬 Готово',
    VIDEO: '🎥 Готово',
  };
  const text = `${labels[type] ?? '✓ Готово'}\n${promptHint}${resultUrl}\n\n/menu — вернуться в меню`;

  const msg = await prisma.message.create({
    data: {
      chatId,
      senderId: PULSAR_GPT_BOT_USER_ID!,
      content: text,
      type: 'TEXT',
    },
    include: {
      sender: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, isBot: true },
      },
    },
  });
  const io = getIO();
  if (io) {
    io.to(`chat:${chatId}`).emit('message:new', {
      id: msg.id, chatId: msg.chatId, senderId: msg.senderId, content: msg.content, type: msg.type,
      replyToId: null, isEdited: false, isDeleted: false, metadata: msg.metadata as any,
      signature: null, signerWallet: null, encryptedContent: null, encryptionType: null,
      createdAt: msg.createdAt.toISOString(), updatedAt: msg.updatedAt.toISOString(),
      sender: msg.sender, status: 'sent', attachments: [],
    } as any);
  }
}

/** Refund a charged PLS amount and mark request as FAILED. */
async function refundAndFail(requestId: string, userId: string, pricePls: bigint | null, reason: string) {
  await prisma.$transaction(async (tx) => {
    await tx.pulsarGptRequest.update({
      where: { id: requestId },
      data: {
        status: PulsarGptStatus.FAILED,
        errorMessage: reason.slice(0, 500),
        completedAt: new Date(),
      },
    });
    if (pricePls && pricePls > 0n) {
      await tx.plsWallet.update({
        where: { userId },
        data: { balance: { increment: pricePls } },
      });
      // Note: we do NOT reverse the burn — burn is a one-way commitment
      // and small enough (10% of price) that it's accepted as platform-
      // operating cost. Refund is full price; user is made whole.
    }
  });
}
