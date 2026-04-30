import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';

export const REWARD_PER_MESSAGE = 1n;
export const REWARD_PER_REACTION = 1n;
export const DAILY_MESSAGE_CAP = 50;
export const DAILY_REACTION_CAP = 30;
export const MIN_MESSAGE_LENGTH = 30;
export const MIN_VERIFICATION_LEVEL = 1;
export const MIN_COMMUNITY_VERIFIED_MEMBERS = 50;

const REDIS_ENABLED_KEY = 'setting:activity.enabled';
const ELIGIBLE_CHATS_KEY = 'activity:eligible_chats';
const ELIGIBLE_CHATS_TTL_SEC = 600; // refresh every 10 min — joins/leaves rarely cross the threshold

export async function isActivityEnabled(): Promise<boolean> {
  const v = await redis.get(REDIS_ENABLED_KEY);
  return v !== 'false';
}

export async function setActivityEnabled(enabled: boolean): Promise<void> {
  await redis.set(REDIS_ENABLED_KEY, enabled ? 'true' : 'false');
}

/** Set of chatIds that qualify as a "verified community". Cached in Redis. */
async function getEligibleChatIds(): Promise<Set<string>> {
  const cached = await redis.get(ELIGIBLE_CHATS_KEY);
  if (cached) {
    try { return new Set(JSON.parse(cached)); } catch { /* fall through */ }
  }
  const chats = await prisma.chat.findMany({
    where: { type: { in: ['GROUP', 'CHANNEL'] } },
    select: {
      id: true,
      _count: {
        select: {
          members: {
            where: {
              leftAt: null,
              user: { verificationLevel: { gte: MIN_VERIFICATION_LEVEL } },
            },
          },
        },
      },
    },
  });
  const ids = chats.filter((c) => c._count.members >= MIN_COMMUNITY_VERIFIED_MEMBERS).map((c) => c.id);
  await redis.setex(ELIGIBLE_CHATS_KEY, ELIGIBLE_CHATS_TTL_SEC, JSON.stringify(ids));
  return new Set(ids);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Atomic increment with cap. Returns true if increment was applied. */
async function incrementUnderCap(key: string, cap: number): Promise<boolean> {
  // INCR + EXPIRE on first hit; check value vs cap.
  const newVal = await redis.incr(key);
  if (newVal === 1) {
    await redis.expire(key, 36 * 3600); // 36h TTL — safely covers any tz
  }
  if (newVal > cap) {
    // Roll back so the next attempt also rejects (idempotent rejection).
    await redis.decr(key);
    return false;
  }
  return true;
}

interface RewardResult { credited: boolean; reason?: string; }

/**
 * Try to reward a sender for a meaningful message in an eligible community.
 * Caller is expected to pass the message metadata after the message has
 * been persisted. Failure here never blocks message delivery.
 */
export async function tryRewardForMessage(opts: {
  senderId: string;
  chatId: string;
  contentLength: number;
  isDeleted: boolean;
  type: string;
}): Promise<RewardResult> {
  if (!(await isActivityEnabled())) return { credited: false, reason: 'disabled' };
  if (opts.isDeleted) return { credited: false, reason: 'deleted' };
  if (opts.type !== 'TEXT') return { credited: false, reason: 'not_text' };
  if (opts.contentLength < MIN_MESSAGE_LENGTH) return { credited: false, reason: 'too_short' };

  const eligible = await getEligibleChatIds();
  if (!eligible.has(opts.chatId)) return { credited: false, reason: 'chat_not_eligible' };

  const sender = await prisma.user.findUnique({
    where: { id: opts.senderId },
    select: { verificationLevel: true,
        role: true, isBot: true },
  });
  if (!sender || sender.isBot) return { credited: false, reason: 'bot_or_missing' };
  if (sender.verificationLevel < MIN_VERIFICATION_LEVEL) return { credited: false, reason: 'unverified' };

  const ok = await incrementUnderCap(`activity:msg:${opts.senderId}:${todayKey()}`, DAILY_MESSAGE_CAP);
  if (!ok) return { credited: false, reason: 'daily_cap' };

  await creditReward(opts.senderId, REWARD_PER_MESSAGE, 'Activity reward (message)');
  return { credited: true };
}

/**
 * Reward the AUTHOR of a message that just received a new reaction.
 * Reactor's userId is also passed to skip self-reactions and bot reactions.
 */
export async function tryRewardForReaction(opts: {
  authorId: string;
  reactorId: string;
  chatId: string;
  isDeleted: boolean;
}): Promise<RewardResult> {
  if (!(await isActivityEnabled())) return { credited: false, reason: 'disabled' };
  if (opts.isDeleted) return { credited: false, reason: 'deleted' };
  if (opts.authorId === opts.reactorId) return { credited: false, reason: 'self_react' };

  const eligible = await getEligibleChatIds();
  if (!eligible.has(opts.chatId)) return { credited: false, reason: 'chat_not_eligible' };

  const [author, reactor] = await Promise.all([
    prisma.user.findUnique({ where: { id: opts.authorId }, select: { verificationLevel: true,
        role: true, isBot: true } }),
    prisma.user.findUnique({ where: { id: opts.reactorId }, select: { verificationLevel: true,
        role: true, isBot: true } }),
  ]);
  if (!author || author.isBot) return { credited: false, reason: 'author_bot' };
  if (!reactor || reactor.isBot) return { credited: false, reason: 'reactor_bot' };
  if (author.verificationLevel < MIN_VERIFICATION_LEVEL) return { credited: false, reason: 'author_unverified' };

  const ok = await incrementUnderCap(`activity:react:${opts.authorId}:${todayKey()}`, DAILY_REACTION_CAP);
  if (!ok) return { credited: false, reason: 'daily_cap' };

  await creditReward(opts.authorId, REWARD_PER_REACTION, 'Activity reward (reaction)');
  return { credited: true };
}

async function creditReward(userId: string, amount: bigint, description: string) {
  const wallet = await prisma.plsWallet.upsert({
    where: { userId },
    create: { userId, balance: amount },
    update: { balance: { increment: amount } },
  });
  await prisma.plsTransaction.create({
    data: { walletId: wallet.id, amount, type: 'REWARD', description },
  });
}
