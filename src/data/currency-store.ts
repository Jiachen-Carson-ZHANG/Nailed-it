import { getBrowserStorage } from '@/lib/browser-storage';

/** Display currency for all customer/merchant UI — always Singapore dollars, never translated. */
export const DISPLAY_CURRENCY = 'SGD' as const;
export type Currency = typeof DISPLAY_CURRENCY;

const LEGACY_STORAGE_KEY = 'nailed-it.currency.v1';

export function loadCurrency(): Currency {
  // Clear any legacy localStorage currency preference (was CNY/USD/etc.).
  const storage = getBrowserStorage('local');
  if (storage?.getItem(LEGACY_STORAGE_KEY) !== DISPLAY_CURRENCY) {
    storage?.setItem(LEGACY_STORAGE_KEY, DISPLAY_CURRENCY);
  }
  return DISPLAY_CURRENCY;
}

/** @deprecated Currency is fixed to SGD; kept for call-site compatibility. */
export function saveCurrency(_c: Currency): void {
  loadCurrency();
}
