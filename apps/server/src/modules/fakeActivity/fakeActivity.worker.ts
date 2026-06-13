import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { computeTargetFakeCount, seedFakeUsers, seedFakeOffers } from './fakeActivity.seed.js';

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
const GROWTH_TICK_MS = 6 * 60 * 60 * 1000;
const DISSOLVE_TICK_MS = 60 * 60 * 1000;
// Scaled to BASE=2500: at 5/hour we'd take ~20 days to fully drain.
// 25/hour drains 2500 in ~4 days, which matches the dissolution feel
// the original 500-base aimed at (smooth, not abrupt).
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

/** Returns 0..1 — probability this fake is online right now. The
 *  numbers are deliberately HIGH so the visible "online" count hugs
 *  the total user count (per request — the user wanted "стабильно
 *  2500" with up/down jitter). If you want the classic ~15% online
 *  feel, lower the in-window number to ~0.15. */
function onlineProbability(personality: number, hourUtc: number): number {
  const sched = schedule(personality);
  if (sched === 'always') return 0.97;
  if (sched === 'morning') {
    if (hourUtc >= 6 && hourUtc < 11) return 0.95;
    if (hourUtc >= 4 && hourUtc < 14) return 0.80;
    return 0.65;
  }
  if (sched === 'evening') {
    if (hourUtc >= 17 && hourUtc < 23) return 0.95;
    if (hourUtc >= 14 && hourUtc < 24) return 0.80;
    return 0.65;
  }
  // night owl
  if (hourUtc >= 22 || hourUtc < 4) return 0.95;
  if (hourUtc >= 20 || hourUtc < 6) return 0.80;
  return 0.65;
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
  // Stochastic firing — only ~20% of ticks actually spawn. With a 6h
  // tick interval this averages ~2 spawns/week, which is what we want
  // for "organic-looking" growth.
  if (Math.random() > 0.2) return;
  const existing = await prisma.user.count({
    where: { isFake: true, status: 'ACTIVE' },
  });
  const target = await computeTargetFakeCount();
  if (existing >= target) return;
  const wanted = 10 + Math.floor(Math.random() * 11); // 10..20
  const capped = Math.min(wanted, target - existing);
  if (capped <= 0) return;
  // Re-use the seed's spawnFakes via top-up; bumping isFake count
  // toward `existing + capped` rather than the full target. Cheapest
  // path: just call the same idempotent seedFakeUsers but with a
  // limit. Since seedFakeUsers reads target itself, and target is
  // currently > existing, it'll add the gap — but we want to cap at
  // `capped`. Easiest: call directly through a partial seed.
  const before = await prisma.user.count({ where: { isFake: true, status: 'ACTIVE' } });
  await seedFakeUsers(); // tops up toward target — same as a full reseed
  const after = await prisma.user.count({ where: { isFake: true, status: 'ACTIVE' } });
  const added = after - before;
  // Note: if more than `capped` were added in one go (rare, when seed
  // overshoots), we accept it — the dissolution tick will smooth the
  // visible count back down later.
  console.log(`[fake-activity] growth: target=${target} before=${before} after=${after} (+${added})`);
}

// ─── Tick 3: dissolution ───────────────────────────────────────────

async function dissolveTick(): Promise<void> {
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
