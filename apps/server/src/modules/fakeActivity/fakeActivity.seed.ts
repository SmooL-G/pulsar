import { randomBytes } from 'crypto';
import bs58 from 'bs58';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';

/**
 * Fake activity seed. Inflates the platform's apparent activity so
 * early adopters don't see an empty graveyard. As real users grow, the
 * worker dissolves these fakes back to zero (see fakeActivity.worker.ts
 * and computeTargetFakeCount below).
 *
 * NEVER read or write the `isFake` flag from a public endpoint —
 * surfacing it would break the whole point. All consumers must use
 * explicit `select` blocks that omit the field.
 */

// ─── Tunables (with env overrides) ─────────────────────────────────

const BATCH_SIZE = 50;
const OFFER_TARGET_RATIO = 0.10; // ~50 offers per 500 fakes
const MAX_OFFERS = 80;

// ─── Realistic data pools ──────────────────────────────────────────

const NAMES_CYRILLIC = [
  'alina', 'egor', 'katya', 'dmitry', 'olga', 'nikita', 'masha', 'vlad',
  'kira', 'tema', 'sasha', 'lera', 'misha', 'nastya', 'maxim', 'dasha',
  'vanya', 'liza', 'andrey', 'sveta', 'ilya', 'polina', 'kolya', 'tanya',
  'roma', 'yulia', 'arseniy', 'vika', 'pasha', 'sonya', 'gleb', 'rita',
  'fedya', 'zhenya', 'kostya', 'angelina', 'rodion', 'milana', 'savva',
  'yaroslav', 'alex', 'kirill', 'denis', 'igor', 'serega', 'vova', 'lyosha',
];

const NAMES_LATIN = [
  'marie', 'jack', 'liam', 'emma', 'noah', 'ava', 'lucas', 'mia', 'oliver',
  'sophia', 'ethan', 'isabella', 'aiden', 'amelia', 'mason', 'harper',
  'logan', 'evelyn', 'james', 'abigail', 'leo', 'charlotte', 'ben',
  'sebastian', 'henry', 'scarlett', 'jacob', 'aria', 'matthew', 'chloe',
  'david', 'penelope', 'levi', 'layla', 'wyatt', 'mila', 'caleb',
  'aubrey', 'isaiah', 'zoe', 'asher', 'lily', 'julian', 'hannah', 'gabriel',
  'nora', 'samuel', 'addison', 'carter', 'eliana', 'owen', 'natalie',
  'jayden', 'avery', 'dylan', 'leah', 'isaac', 'audrey',
];

const SUFFIXES = ['', '', '_', '.', '-', '01', '02', '03', '07', '88', '99',
  '_pls', '_sol', 'crypto', 'trader', 'btc'];

const BIOS = [
  'crypto enthusiast', 'PLS to the moon 🚀', 'building cool stuff',
  'just here for the lulz', 'web3 native', 'DeFi degen', 'NFT collector',
  'love solana', 'BTC maxi', 'always early', 'trading PLS daily',
  'looking for alpha', 'hodling 4ever', 'tg @nope', 'dm me trades',
  'p2p mostly', 'ru/en', 'msk gmt+3', 'verified merchant', 'fast deals',
  'крипто рулит', 'свобода превыше всего', 'хочу мерседес', 'трейдер',
  'майнер с 2017', 'на ETH с 2018, на SOL с 2021', 'PLS приехал',
  'отдам солану дёшево', 'покупаю долго хранят', 'без скама, как договорились',
  'reply within 5min', 'instant release', 'serious traders only',
  'no jokes', 'KYC pls', 'AML clean', 'crypto degen since 2020',
];

const OFFER_TERMS = [
  'Сбербанк / Тинькофф / Альфа',
  'Tinkoff only, instant release',
  'СБП любой банк',
  'USDT TRC20 only',
  'Cash only, Moscow center',
  'Russian banks only, fast',
  'PayPal F&F preferred',
  'Revolut, Wise OK',
  'Reply within 10 min or cancel',
  'No exchange-flagged wallets',
  'Mer­chant verified, 0 disputes',
  'Сбер / Райф / Газпром / Точка',
  'СБП обязательно, без переводов на карту',
  'Quick deal, +1% bonus if released <5min',
  'KYC required for trades > $500',
  'Online 9-21 MSK',
  'AML-clean wallets only',
  'Limit per trade 100 USD',
  'СБП Тиньк/Сбер, время 24/7',
  'Любая карта РФ',
];

// ─── Deterministic random ──────────────────────────────────────────

function rnd(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[rnd(0, arr.length - 1)];
}

function weighted<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

// ─── Generators ────────────────────────────────────────────────────

function genUsername(): string {
  const base = pick([...NAMES_CYRILLIC, ...NAMES_LATIN]);
  const suffix = pick(SUFFIXES);
  const num = Math.random() < 0.6 ? String(rnd(1, 999)) : '';
  // 32-char hard cap from schema
  return `${base}${suffix}${num}`.slice(0, 32).toLowerCase();
}

function genDisplayName(username: string): string {
  // Most fakes use a simple capitalized form of the base name.
  const base = (username.match(/^[a-zа-я]+/i)?.[0] || username).slice(0, 16);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function genWalletAddress(): string {
  // 32 random bytes → 43-44 char base58 string, indistinguishable
  // from a real Solana pubkey at a glance.
  return bs58.encode(randomBytes(32));
}

function genCreatedAt(): Date {
  // Random in last 18 months, weighted toward last 6 months so
  // recent signups dominate (organic growth curve).
  const maxDaysAgo = 540;
  const skewedDays = Math.floor(Math.pow(Math.random(), 1.7) * maxDaysAgo);
  return new Date(Date.now() - skewedDays * 24 * 60 * 60 * 1000);
}

function genLastSeenAt(): Date {
  // Recent — within last 7 days.
  return new Date(Date.now() - rnd(0, 7 * 24 * 60 * 60 * 1000));
}

function genVerificationLevel(): number {
  return weighted([
    { value: 0, weight: 60 },
    { value: 1, weight: 30 },
    { value: 2, weight: 8 },
    { value: 3, weight: 2 },
  ]);
}

function genMerchantTier(): 'NONE' | 'TRUSTED' | 'OFFICIAL' {
  return weighted<'NONE' | 'TRUSTED' | 'OFFICIAL'>([
    { value: 'NONE', weight: 95 },
    { value: 'TRUSTED', weight: 4 },
    { value: 'OFFICIAL', weight: 1 },
  ]);
}

interface FakePayload {
  username: string;
  walletAddress: string;
  displayName: string;
  bio: string;
  createdAt: Date;
  lastSeenAt: Date;
  verificationLevel: number;
  merchantTier: 'NONE' | 'TRUSTED' | 'OFFICIAL';
  fakePersonality: number;
  initialBalance: bigint;
}

function generateFake(): FakePayload {
  return {
    username: genUsername(),
    walletAddress: genWalletAddress(),
    displayName: '',  // filled below
    bio: pick(BIOS),
    createdAt: genCreatedAt(),
    lastSeenAt: genLastSeenAt(),
    verificationLevel: genVerificationLevel(),
    merchantTier: genMerchantTier(),
    fakePersonality: rnd(0, 99),
    initialBalance: BigInt(rnd(100, 50_000)),
  };
}

// ─── Target formula (shared with worker) ───────────────────────────

export async function computeTargetFakeCount(): Promise<number> {
  const realActive = await prisma.user.count({
    where: { status: 'ACTIVE', isFake: false, isBot: false },
  });
  const BASE = env.FAKE_ACTIVITY_BASE;
  const THRESHOLD = env.FAKE_ACTIVITY_THRESHOLD;
  return Math.max(0, BASE - Math.max(0, realActive - THRESHOLD));
}

// ─── Seeders ───────────────────────────────────────────────────────

/** Create `deficit` fake users + their PLS wallets in batches.
 *  Username/walletAddress collisions retried per-row (rare at this
 *  scale but cheap to handle).
 */
async function spawnFakes(deficit: number): Promise<number> {
  let created = 0;
  for (let i = 0; i < deficit; i += BATCH_SIZE) {
    const batch = Math.min(BATCH_SIZE, deficit - i);
    for (let j = 0; j < batch; j++) {
      const f = generateFake();
      f.displayName = genDisplayName(f.username);
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              username: f.username,
              walletAddress: f.walletAddress,
              displayName: f.displayName,
              bio: f.bio,
              walletType: 'CUSTODIAL',
              status: 'ACTIVE',
              role: 'USER',
              isBot: false,
              isFake: true,
              fakePersonality: f.fakePersonality,
              verificationLevel: f.verificationLevel,
              merchantTier: f.merchantTier,
              isOnline: false,
              lastSeenAt: f.lastSeenAt,
              createdAt: f.createdAt,
            },
          });
          await tx.plsWallet.create({
            data: { userId: user.id, balance: f.initialBalance },
          });
        });
        created++;
      } catch (e: any) {
        // Unique constraint collision on username/walletAddress —
        // skip and let the next tick fill the gap.
        if (e?.code !== 'P2002') console.warn('[fake-activity] spawn err:', e?.message);
      }
    }
  }
  return created;
}

/** Idempotent seed: tops up fakes toward computed target. */
export async function seedFakeUsers(): Promise<{ existing: number; target: number; created: number }> {
  if (!env.FAKE_ACTIVITY_ENABLED) return { existing: 0, target: 0, created: 0 };
  const existing = await prisma.user.count({
    where: { isFake: true, status: 'ACTIVE' },
  });
  const target = await computeTargetFakeCount();
  if (existing >= target) {
    return { existing, target, created: 0 };
  }
  const created = await spawnFakes(target - existing);
  return { existing, target, created };
}

/** Top up P2P offers from fakes to ~OFFER_TARGET_RATIO of fake count
 *  (cap MAX_OFFERS). Raw INSERT — no balance lock since fake offers
 *  never settle (openTrade intercepts and throws MERCHANT_BUSY).
 */
export async function seedFakeOffers(): Promise<{ existing: number; target: number; created: number }> {
  if (!env.FAKE_ACTIVITY_ENABLED) return { existing: 0, target: 0, created: 0 };
  const fakes = await prisma.user.findMany({
    where: { isFake: true, status: 'ACTIVE' },
    select: { id: true },
  });
  if (fakes.length === 0) return { existing: 0, target: 0, created: 0 };
  const existing = await prisma.p2POffer.count({
    where: { seller: { isFake: true }, status: 'ACTIVE' },
  });
  const target = Math.min(MAX_OFFERS, Math.floor(fakes.length * OFFER_TARGET_RATIO));
  if (existing >= target) return { existing, target, created: 0 };
  const deficit = target - existing;
  // Pick random fake sellers — shuffle and slice.
  const shuffled = [...fakes].sort(() => Math.random() - 0.5).slice(0, deficit);
  const basePrice = parseFloat(env.PLS_USD_RATE || '0.001');
  let created = 0;
  for (const seller of shuffled) {
    const jitter = 1 + (Math.random() * 0.16 - 0.08); // ±8%
    const price = (basePrice * jitter).toFixed(6);
    const totalAmount = BigInt(rnd(200, 10_000));
    const minTrade = BigInt(rnd(50, 500));
    const maxTrade = BigInt(rnd(500, 5_000));
    const side = Math.random() < 0.7 ? 'SELL' : 'BUY';
    const terms = pick(OFFER_TERMS);
    try {
      await prisma.p2POffer.create({
        data: {
          sellerId: seller.id,
          side: side as any,
          pricePerPlsUsd: new Prisma.Decimal(price),
          totalAmount,
          remainingAmount: totalAmount,
          minTrade,
          maxTrade,
          terms,
          status: 'ACTIVE',
        },
      });
      created++;
    } catch (e: any) {
      console.warn('[fake-activity] offer err:', e?.message);
    }
  }
  return { existing, target, created };
}
