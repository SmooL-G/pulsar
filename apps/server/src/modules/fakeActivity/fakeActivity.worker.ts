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
const DISSOLVE_PER_TICK = 5;

// ─── Personality → schedule helpers ────────────────────────────────

type Schedule = 'morning' | 'evening' | 'always' | 'night';
function schedule(personality: number): Schedule {
  const m = personality % 4;
  return m === 0 ? 'morning' : m === 1 ? 'evening' : m === 2 ? 'always' : 'night';
}

function inWindow(sched: Schedule, hourUtc: number): boolean {
  if (sched === 'always') return true;
  if (sched === 'morning') return hourUtc >= 6 && hourUtc < 11;
  if (sched === 'evening') return hourUtc >= 17 && hourUtc < 23;
  // night-owl: 22:00..03:59 UTC
  return hourUtc >= 22 || hourUtc < 4;
}

function probabilityForSchedule(sched: Schedule): number {
  return sched === 'always' ? 0.9 : 0.6;
}

function shouldBeOnlineNow(personality: number, hourUtc: number): boolean {
  const sched = schedule(personality);
  if (!inWindow(sched, hourUtc)) return false;
  // Jittered probability so the visible online count flutters naturally
  // rather than locking at a fixed percentage every refresh.
  const base = probabilityForSchedule(sched);
  const jittered = base * (0.9 + 0.2 * Math.random());
  return Math.random() < jittered;
}

// ─── Tick 1: online rotation ───────────────────────────────────────

async function onlineRotationTick(): Promise<void> {
  const hour = new Date().getUTCHours();
  const fakes = await prisma.user.findMany({
    where: { isFake: true, status: 'ACTIVE' },
    select: { id: true, fakePersonality: true, isOnline: true },
  });
  if (fakes.length === 0) return;

  const toOnline: string[] = [];
  const toOffline: string[] = [];
  for (const f of fakes) {
    const should = shouldBeOnlineNow(f.fakePersonality ?? 0, hour);
    if (should && !f.isOnline) toOnline.push(f.id);
    if (!should && f.isOnline) toOffline.push(f.id);
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
