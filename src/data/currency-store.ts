import { getBrowserStorage } from '@/lib/browser-storage';

const STORAGE_KEY = 'nailed-it.currency.v1';
export const CURRENCY_OPTIONS = ['CNY', 'SGD', 'AUD', 'CAD', 'CHF', 'EUR', 'USD', 'JPY', 'KRW'] as const;
export type Currency = typeof CURRENCY_OPTIONS[number];
export const DEFAULT_CURRENCY: Currency = 'CNY';

export function loadCurrency(): Currency {
  const storage = getBrowserStorage('local');
  if (!storage) return DEFAULT_CURRENCY;
  const raw = storage.getItem(STORAGE_KEY);
  if (raw && CURRENCY_OPTIONS.includes(raw as Currency)) return raw as Currency;
  return DEFAULT_CURRENCY;
}

export function saveCurrency(c: Currency): void {
  const storage = getBrowserStorage('local');
  if (!storage) return;
  storage.setItem(STORAGE_KEY, c);
}
