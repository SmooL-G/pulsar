import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Currency = 'USD' | 'RUB' | 'EUR' | 'UAH' | 'KZT' | 'BYN';

export const CURRENCIES: { code: Currency; symbol: string; name: string }[] = [
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'RUB', symbol: '₽',   name: 'Российский рубль' },
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'UAH', symbol: '₴',   name: 'Українська гривня' },
  { code: 'KZT', symbol: '₸',   name: 'Қазақстандық теңге' },
  { code: 'BYN', symbol: 'Br',  name: 'Беларускі рубель' },
];

export interface PriceSnapshot {
  pls: { usd: number; change24h: number; source: 'presale' | 'dex' };
  fx: Record<Currency, number>;
  updatedAt: string;
}

// Auto-pick currency from browser locale on first run; user can change
// in Settings or via the inline picker on the price card.
function defaultCurrencyFromLocale(): Currency {
  if (typeof navigator === 'undefined') return 'USD';
  const lang = navigator.language?.toLowerCase() ?? '';
  if (lang.startsWith('ru')) return 'RUB';
  if (lang.startsWith('uk')) return 'UAH';
  if (lang.startsWith('kk') || lang.startsWith('kz')) return 'KZT';
  if (lang.startsWith('be')) return 'BYN';
  if (/^(de|fr|es|it|pt|nl)/.test(lang)) return 'EUR';
  return 'USD';
}

interface CurrencyState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
}

export const useDisplayCurrency = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: defaultCurrencyFromLocale(),
      setCurrency: (c) => set({ currency: c }),
    }),
    { name: 'pulsar:display-currency' },
  ),
);

// Module-scoped fetch state shared across hook subscribers — no need
// to add tanstack-query for one endpoint that refreshes every 60s.
let cached: PriceSnapshot | null = null;
let cachedAt = 0;
let inFlight: Promise<PriceSnapshot | null> | null = null;
const subscribers = new Set<(s: PriceSnapshot | null) => void>();
const REFRESH_MS = 60_000;

async function fetchPrice(): Promise<PriceSnapshot | null> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/api/v1/price');
      if (!res.ok) return null;
      const snap = (await res.json()) as PriceSnapshot;
      cached = snap;
      cachedAt = Date.now();
      subscribers.forEach((fn) => fn(snap));
      return snap;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export function usePlsPrice(): PriceSnapshot | null {
  const [snap, setSnap] = useState<PriceSnapshot | null>(cached);

  useEffect(() => {
    subscribers.add(setSnap);
    if (!cached || Date.now() - cachedAt > REFRESH_MS) {
      fetchPrice();
    }
    const id = setInterval(() => fetchPrice(), REFRESH_MS);
    return () => {
      subscribers.delete(setSnap);
      clearInterval(id);
    };
  }, []);

  return snap;
}

/** Convert PLS amount to a display currency. Returns null until prices load. */
export function plsToFiat(amountPls: number | bigint, snap: PriceSnapshot | null, currency: Currency): number | null {
  if (!snap) return null;
  const amt = typeof amountPls === 'bigint' ? Number(amountPls) : amountPls;
  const usd = amt * snap.pls.usd;
  return usd * snap.fx[currency];
}

/** Format a fiat number into a localized string with the right symbol. */
export function formatFiat(value: number, currency: Currency, digits?: number): string {
  const cur = CURRENCIES.find((c) => c.code === currency);
  const sym = cur?.symbol ?? currency;
  const d = digits ?? (Math.abs(value) >= 1 ? 2 : 4);
  const formatted = value.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  // Symbol placement: prefix for $€ symbols, suffix for ruble-family
  if (currency === 'RUB' || currency === 'UAH' || currency === 'KZT' || currency === 'BYN') {
    return `${formatted} ${sym}`;
  }
  return `${sym}${formatted}`;
}
