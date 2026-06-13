import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { computeTargetFakeCount, spawnFakes, seedFakeOffers } from './fakeActivity.seed.js';

/**
 * Fake-activity background worker. Runs three independent ticks:
 *
 *   1. Online rotation (every 30s) — flips fakes between isOnline
 *      true/false on a deterministic personality+hour schedule so the
 *      online counter naturally fluctuates without ever showing all
 *      500 at once.
 *
 *   2. Growth (every 6h, fires with p=0.2 → ~2 spawns/week) — adds
 *      10-20 fakes if total < target. Stops when the dissolution
 *      formula caps further growth.
 *
 *   3. Dissolution (every 1h) — if real users have grown enough that
 *      target < current, soft-deletes oldest fakes (max 5/hour) and
 *      cancels their open P2P offers. Smooth drain, ~4 days to fully
 *      empty a 500-base.
 */

const ONLINE_TICK_MS = 30_000;
// 12h tick + p=0.15 fire ≈ 2 spawns/week (target "2 раза в неделю").
const GROWTH_TICK_MS = 12 * 60 * 60 * 1000;
const GROWTH_FIRE_P = 0.15;
const GROWTH_MIN = 10;
const GROWTH_MAX = 20;
const DISSOLVE_TICK_MS = 60 * 60 * 1000;
// Scaled to BASE=2500: 25/hour drains 2500 in ~4 days when real
// users overtake the threshold curve. Same shape as the old 500-base.
const DISSOLVE_PER_TICK = 25;

// ─── Personality → online probability ──────────────────────────────
//
// Each tick re-rolls per-fake online status with a personality-biased
// probability. The constant per-tick churn (some fakes go online, some
// go offline) is what makes the public counter *feel* alive instead
// of locked at a number. We also nudge the target up/down with a slow
// sin-wave + small per-tick jitter so the overall count visibly
// breathes over the day instead of camping a single value.
//
// Personality (0..3):
//   0 — morning person (peak 6-11 UTC)
//   1 — evening person (peak 17-23 UTC)
//   2 — always-on power user (peak everywhere)
//   3 — night owl (peak 22-04 UTC)

type Schedule = 'morning' | 'evening' | 'always' | 'night';
function schedule(personality: number): Schedule {
  const m = personality % 4;
  return m === 0 ? 'morning' : m === 1 ? 'evening' : m === 2 ? 'always' : 'night';
}

/** Returns 0..1 — probability this fake is online right now.
 *  Average across personalities + hours-of-day ≈ 0.85 (the user
 *  wanted ~85% online with jitter). To shift the average, scale
 *  every literal by the same factor. */
function onlineProbability(personality: number, hourUtc: number): number {
  const sched = schedule(personality);
  if (sched === 'always') return 0.92;
  if (sched === 'morning') {
    if (hourUtc >= 6 && hourUtc < 11) return 0.95;
    if (hourUtc >= 4 && hourUtc < 14) return 0.85;
    return 0.72;
  }
  if (sched === 'evening') {
    if (hourUtc >= 17 && hourUtc < 23) return 0.95;
    if (hourUtc >= 14 && hourUtc < 24) return 0.85;
    return 0.72;
  }
  // night owl
  if (hourUtc >= 22 || hourUtc < 4) return 0.95;
  if (hourUtc >= 20 || hourUtc < 6) return 0.85;
  return 0.72;
}

// ─── Tick 1: online rotation ───────────────────────────────────────

async function onlineRotationTick(): Promise<void> {
  const hour = new Date().getUTCHours();
  const fakes = await prisma.user.findMany({
    where: { isFake: true, status: 'ACTIVE' },
    select: { id: true, fakePersonality: true, isOnline: true },
  });
  if (fakes.length === 0) return;

  // Small global multiplier varies the overall online ceiling smoothly.
  // sin-wave over a 90-minute period adds ±3% to the baseline, plus
  // a small per-tick uniform jitter. Net effect: the visible online
  // count drifts up and down by tens of users every minute.
  const minutes = Date.now() / 60000;
  const wave = 0.97 + 0.03 * Math.sin(minutes * Math.PI / 45);
  const jitter = 0.99 + 0.02 * Math.random();
  const globalScale = wave * jitter; // ~0.95..1.02

  const toOnline: string[] = [];
  const toOffline: string[] = [];
  for (const f of fakes) {
    const p = onlineProbability(f.fakePersonality ?? 0, hour) * globalScale;
    const shouldOn = Math.random() < Math.min(1, p);
    if (shouldOn && !f.isOnline) toOnline.push(f.id);
    if (!shouldOn && f.isOnline) toOffline.push(f.id);
  }
  const now = new Date();
  if (toOnline.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: toOnline } },
      data: { isOnline: true, lastSeenAt: now },
    });
  }
  if (toOffline.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: toOffline } },
      data: { isOnline: false, lastSeenAt: now },
    });
  }
}

// ─── Tick 2: growth ────────────────────────────────────────────────

async function growthTick(): Promise<void> {
  // Stochastic firing — most ticks no-op. With 12h interval + p=0.15
  // we average ~2 spawns/week, which is what the user asked for
  // ("прирост по 10-20 пользователей 2 раза в неделю"). Each fire adds
  // exactly 10-20 fakes on TOP of the baseline. No hard cap — the
  // total grows linearly until real users overtake THRESHOLD, at
  // which point the dissolveTick takes over.
  if (Math.random() > GROWTH_FIRE_P) return;
  // Pause growth once dissolution is active (real users already
  // overtaking) — otherwise growth would just feed the dissolver.
  const realActive = await prisma.user.count({
    where: { status: 'ACTIVE', isFake: false, isBot: false },
  });
  if (realActive > env.FAKE_ACTIVITY_THRESHOLD) {
    return;
  }
  const wanted = GROWTH_MIN + Math.floor(Math.random() * (GROWTH_MAX - GROWTH_MIN + 1));
  const created = await spawnFakes(wanted);
  const total = await prisma.user.count({ where: { isFake: true, status: 'ACTIVE' } });
  console.log(`[fake-activity] growth: +${created} (total fakes=${total}, real=${realActive})`);
}

// ─── Tick 3: dissolution ───────────────────────────────────────────

async function dissolveTick(): Promise<void> {
  // Dissolution only fires once real users overtake the THRESHOLD.
  // Below that, the growth tick is free to push total fakes ABOVE
  // baseline organically without dissolution clawing them back.
  const realActive = await prisma.user.count({
    where: { status: 'ACTIVE', isFake: false, isBot: false },
  });
  if (realActive <= env.FAKE_ACTIVITY_THRESHOLD) return;
  const total = await prisma.user.count({
    where: { isFake: true, status: 'ACTIVE' },
  });
  const target = await computeTargetFakeCount();
  if (total <= target) return;
  const excess = Math.min(DISSOLVE_PER_TICK, total - target);
  const victims = await prisma.user.findMany({
    where: { isFake: true, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' }, // oldest first
    take: excess,
    select: { id: true },
  });
  for (const v of victims) {
    try {
      await prisma.$transaction([
        prisma.p2POffer.updateMany({
          where: { sellerId: v.id, status: 'ACTIVE' },
          data: { status: 'CANCELLED' },
        }),
        prisma.user.update({
          where: { id: v.id },
          data: {
            status: 'DELETED',
            isOnline: false,
            username: `deleted_${v.id.slice(0, 8)}`,
          },
        }),
      ]);
    } catch (e: any) {
      console.warn('[fake-activity] dissolve err:', e?.message);
    }
  }
  if (victims.length > 0) {
    console.log(`[fake-activity] dissolved ${victims.length} fakes (total=${total} → target=${target})`);
  }
}

// ─── Top-up offers (called occasionally) ───────────────────────────

async function topUpOffersTick(): Promise<void> {
  try {
    const res = await seedFakeOffers();
    if (res.created > 0) {
      console.log(`[fake-activity] top-up offers: +${res.created}`);
    }
  } catch (e: any) {
    console.warn('[fake-activity] offer top-up err:', e?.message);
  }
}

// ─── Entrypoint ────────────────────────────────────────────────────

export function startFakeActivityWorker(): void {
  if (!env.FAKE_ACTIVITY_ENABLED) return;
  console.log('[fake-activity-worker] started');

  const wrap = (name: string, fn: () => Promise<void>) => async () => {
    try {
      await fn();
    } catch (err) {
      console.error(`[fake-activity-worker] ${name} failed:`, err);
    }
  };

  // Online rotation — starts almost immediately, runs every 30s.
  setTimeout(wrap('online', onlineRotationTick), 5_000);
  setInterval(wrap('online', onlineRotationTick), ONLINE_TICK_MS);

  // Growth — first tick at +1 min, then every 6h (stochastic).
  setTimeout(wrap('growth', growthTick), 60_000);
  setInterval(wrap('growth', growthTick), GROWTH_TICK_MS);

  // Dissolution — first at +2 min, then hourly.
  setTimeout(wrap('dissolve', dissolveTick), 120_000);
  setInterval(wrap('dissolve', dissolveTick), DISSOLVE_TICK_MS);

  // Offer top-up — first at +5 min, then every 4h.
  setTimeout(wrap('offers', topUpOffersTick), 5 * 60_000);
  setInterval(wrap('offers', topUpOffersTick), 4 * 60 * 60 * 1000);
}
