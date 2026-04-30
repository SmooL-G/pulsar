import { prisma } from '../../config/database.js';

// Tier: amount thresholds → color + minutes pinned at top of chat
export const SUPERCHAT_TIERS = [
  { min: 25_000n,                color: 'red',    pinMinutes: 30 },
  { min: 5_000n,  max: 24_999n,  color: 'yellow', pinMinutes: 5 },
  { min: 1_000n,  max: 4_999n,   color: 'green',  pinMinutes: 1 },
  { min: 100n,    max: 999n,     color: 'blue',   pinMinutes: 0 },
] as const;

export const MIN_SUPERCHAT = 100n;
export const MAX_SUPERCHAT = 1_000_000n;
export const OWNER_SHARE_BPS = 7000; // 70.00%
// 30% is burned (i.e. simply not credited to anyone — leaves circulation).

export function tierFor(amount: bigint): { color: string; pinMinutes: number } | null {
  for (const t of SUPERCHAT_TIERS) {
    if (amount >= t.min && (!('max' in t) || amount <= (t as any).max)) {
      return { color: t.color, pinMinutes: t.pinMinutes };
    }
  }
  return null;
}

export class SuperchatError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/**
 * Atomically: validate, deduct PLS from sender, credit 70% to chat owner
 * (or null-burn if no owner — DM has no owner, but we already block DMs),
 * burn the rest, and create the SUPERCHAT message row.
 *
 * Returns the freshly-created message with sender included so the caller
 * can broadcast it via socket. The caller is also responsible for
 * emitting wallet:balance-updated to both wallets.
 */
export async function sendSuperchat(opts: {
  senderId: string;
  chatId: string;
  content: string;
  amount: bigint;
}) {
  const { senderId, chatId, content } = opts;
  const amount = opts.amount;

  if (amount < MIN_SUPERCHAT) {
    throw new SuperchatError('AMOUNT_TOO_LOW', `Minimum ${MIN_SUPERCHAT} PLS`);
  }
  if (amount > MAX_SUPERCHAT) {
    throw new SuperchatError('AMOUNT_TOO_HIGH', `Maximum ${MAX_SUPERCHAT} PLS`);
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new SuperchatError('EMPTY_CONTENT', 'Message cannot be empty');
  }
  if (trimmed.length > 200) {
    throw new SuperchatError('CONTENT_TOO_LONG', 'Max 200 chars for SuperChat');
  }

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { id: true, type: true, ownerId: true },
  });
  if (!chat) throw new SuperchatError('NOT_FOUND', 'Chat not found');
  if (chat.type !== 'GROUP' && chat.type !== 'CHANNEL') {
    throw new SuperchatError('WRONG_CHAT_TYPE', 'SuperChat works only in groups/channels');
  }
  if (!chat.ownerId) {
    throw new SuperchatError('NO_OWNER', 'Chat has no owner to receive funds');
  }
  if (chat.ownerId === senderId) {
    throw new SuperchatError('SELF_SUPERCHAT', 'Cannot SuperChat your own chat');
  }

  // Sender must be a member of the chat.
  const member = await prisma.chatMember.findFirst({
    where: { chatId, userId: senderId, leftAt: null },
    select: { id: true },
  });
  if (!member) throw new SuperchatError('NOT_MEMBER', 'Not a member of this chat');

  const senderWallet = await prisma.plsWallet.findUnique({ where: { userId: senderId } });
  if (!senderWallet) throw new SuperchatError('NO_WALLET', 'Wallet not found');
  if (senderWallet.balance < amount) {
    throw new SuperchatError('INSUFFICIENT_FUNDS', 'Not enough PLS');
  }

  const ownerShare = (amount * BigInt(OWNER_SHARE_BPS)) / 10000n; // floor; remainder burns
  const ownerWallet = await prisma.plsWallet.upsert({
    where: { userId: chat.ownerId },
    create: { userId: chat.ownerId, balance: 0n },
    update: {},
  });

  const tier = tierFor(amount)!;
  const pinnedUntil = tier.pinMinutes > 0
    ? new Date(Date.now() + tier.pinMinutes * 60 * 1000)
    : null;

  const [, , , , message] = await prisma.$transaction([
    prisma.plsWallet.update({
      where: { id: senderWallet.id },
      data: { balance: { decrement: amount } },
    }),
    prisma.plsTransaction.create({
      data: {
        walletId: senderWallet.id,
        amount: -amount,
        type: 'TRANSFER',
        description: `SuperChat in chat ${chatId.slice(0, 8)}`,
      },
    }),
    prisma.plsWallet.update({
      where: { id: ownerWallet.id },
      data: { balance: { increment: ownerShare } },
    }),
    prisma.plsTransaction.create({
      data: {
        walletId: ownerWallet.id,
        amount: ownerShare,
        type: 'REWARD',
        description: `SuperChat from @${senderId.slice(0, 8)}`,
      },
    }),
    prisma.message.create({
      data: {
        chatId,
        senderId,
        content: trimmed,
        type: 'SUPERCHAT',
        superchatAmount: amount,
        superchatTier: tier.color,
        pinnedUntil,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            verificationLevel: true,
            profileBadge: true,
            nickColor: true,
            nftAvatarMint: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return {
    message,
    senderBalance: senderWallet.balance - amount,
    ownerBalance: ownerWallet.balance + ownerShare,
    ownerId: chat.ownerId,
    ownerShare,
    burned: amount - ownerShare,
    tier,
  };
}
