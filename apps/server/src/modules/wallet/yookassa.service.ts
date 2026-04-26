import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { randomUUID } from 'crypto';

const YK_BASE = 'https://api.yookassa.ru/v3';

export interface PlsPackage {
  amountPls: number;
  amountRub: number;
  discountPct: number; // 0..40
}

/**
 * Allowed PLS top-up packages. Pricing: 1 PLS = 1 ₽ at base, with a
 * progressive volume discount capped at 40%. The set is locked to these
 * exact tiers so we never accept arbitrary RUB amounts from the client.
 */
export const PLS_PACKAGES: PlsPackage[] = [
  { amountPls: 500,    amountRub: 500,   discountPct: 0  },
  { amountPls: 2_500,  amountRub: 2_250, discountPct: 10 },
  { amountPls: 5_000,  amountRub: 4_000, discountPct: 20 },
  { amountPls: 25_000, amountRub: 17_500, discountPct: 30 },
  { amountPls: 100_000, amountRub: 60_000, discountPct: 40 },
];

export function findPackage(amountPls: number): PlsPackage | undefined {
  return PLS_PACKAGES.find((p) => p.amountPls === amountPls);
}

interface YooKassaPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  paid: boolean;
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url?: string };
  metadata?: Record<string, string>;
}

function ykAuth() {
  const shop = env.YOOKASSA_SHOP_ID;
  const secret = env.YOOKASSA_SECRET_KEY;
  if (!shop || !secret) throw new Error('YOOKASSA credentials missing');
  return 'Basic ' + Buffer.from(`${shop}:${secret}`).toString('base64');
}

/** Create a YooKassa payment, return the redirect URL the user should visit. */
export async function createPayment(opts: {
  userId: string;
  pack: PlsPackage;
  returnUrl: string;
}): Promise<{ confirmationUrl: string; paymentId: string }> {
  const idem = randomUUID();
  const body = {
    amount: { value: `${opts.pack.amountRub}.00`, currency: 'RUB' },
    confirmation: { type: 'redirect', return_url: opts.returnUrl },
    capture: true,
    description: `Pulsar — ${opts.pack.amountPls.toLocaleString()} PLS`,
    metadata: {
      type: 'pls_topup',
      userId: opts.userId,
      amountPls: String(opts.pack.amountPls),
    },
  };
  const res = await fetch(`${YK_BASE}/payments`, {
    method: 'POST',
    headers: {
      'Authorization': ykAuth(),
      'Content-Type': 'application/json',
      'Idempotence-Key': idem,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`YooKassa create failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as YooKassaPayment;
  const url = data.confirmation?.confirmation_url;
  if (!url) throw new Error('YooKassa did not return confirmation_url');

  await prisma.plsPurchase.create({
    data: {
      userId: opts.userId,
      amountPls: BigInt(opts.pack.amountPls),
      amountRub: opts.pack.amountRub,
      yookassaPaymentId: data.id,
      status: 'PENDING',
    },
  });

  return { confirmationUrl: url, paymentId: data.id };
}

/** Fetch payment status from YooKassa (used by polling callback). */
export async function fetchPaymentStatus(paymentId: string): Promise<YooKassaPayment> {
  const res = await fetch(`${YK_BASE}/payments/${paymentId}`, {
    headers: { 'Authorization': ykAuth() },
  });
  if (!res.ok) {
    throw new Error(`YooKassa fetch failed: ${res.status}`);
  }
  return (await res.json()) as YooKassaPayment;
}

/**
 * Idempotent: if the purchase row is already PAID, this is a no-op. Otherwise
 * marks it PAID, credits PLS to the user's wallet (creating the wallet if
 * needed), and returns true if PLS was actually credited (so the caller can
 * push a notification).
 */
export async function markPaidAndCredit(paymentId: string): Promise<boolean> {
  const purchase = await prisma.plsPurchase.findUnique({
    where: { yookassaPaymentId: paymentId },
  });
  if (!purchase) return false;
  if (purchase.status === 'PAID') return false;

  await prisma.$transaction([
    prisma.plsPurchase.update({
      where: { id: purchase.id },
      data: { status: 'PAID', paidAt: new Date() },
    }),
    prisma.plsWallet.upsert({
      where: { userId: purchase.userId },
      create: { userId: purchase.userId, balance: purchase.amountPls },
      update: { balance: { increment: purchase.amountPls } },
    }),
    prisma.plsTransaction.create({
      data: {
        fromUserId: null,
        toUserId: purchase.userId,
        amount: purchase.amountPls,
        type: 'DEPOSIT',
        note: `YooKassa ${purchase.amountRub} RUB`,
      },
    }),
  ]);
  return true;
}
