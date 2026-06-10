import { getBrowserStorage } from '@/lib/browser-storage';

export const SUPPORTED_CURRENCIES = ['CNY', 'SGD', 'AUD', 'CAD', 'EUR', 'USD', 'JPY', 'KRW', 'FRF'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'SGD';

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
