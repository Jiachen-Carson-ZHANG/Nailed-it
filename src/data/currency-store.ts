import { getBrowserStorage } from '@/lib/browser-storage';

// FRF (French franc) was retired in 2002 — France uses EUR, and Intl.NumberFormat throws on it.
export const SUPPORTED_CURRENCIES = ['CNY', 'SGD', 'AUD', 'CAD', 'EUR', 'USD', 'JPY', 'KRW'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'SGD';

// Prices are authored + stored in SGD cents (the catalog base). The display picker converts with a
// FROZEN rate table — deliberately not live FX. A nail salon is not a financial institution; rates
// move <1%/day and demo prices aren't traded, so a fixed table is honest and reproducible. Update
// these numbers to re-peg. Base SGD = 1.
export const FX_FROM_SGD: Record<Currency, number> = {
  SGD: 1,
  CNY: 5.3,
  USD: 0.74,
  AUD: 1.13,
  CAD: 1.02,
  EUR: 0.69,
  JPY: 116,
  KRW: 1010,
};

const LEGACY_STORAGE_KEY = 'nailed-it.currency.v1';

export function loadCurrency(): Currency {
  const storage = getBrowserStorage('local');
  const stored = storage?.getItem(LEGACY_STORAGE_KEY);
  if (stored && (SUPPORTED_CURRENCIES as readonly string[]).includes(stored)) {
    return stored as Currency;
  }
  storage?.setItem(LEGACY_STORAGE_KEY, DEFAULT_CURRENCY);
  return DEFAULT_CURRENCY;
}

export function saveCurrency(c: Currency): void {
  const storage = getBrowserStorage('local');
  storage?.setItem(LEGACY_STORAGE_KEY, c);
}
