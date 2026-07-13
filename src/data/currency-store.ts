import { getBrowserStorage } from '@/lib/browser-storage';

// FRF (French franc) was retired in 2002 — France uses EUR, and Intl.NumberFormat throws on it.
export const SUPPORTED_CURRENCIES = ['CNY', 'SGD', 'AUD', 'CAD', 'EUR', 'USD', 'JPY', 'KRW'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = 'CNY';

// 价格以人民币分（CNY cents）为基准编写并存储（面向国内美团市场）。显示切换用一张 FROZEN 汇率表
// 换算——刻意不用实时汇率。美甲店不是金融机构；汇率日波动 <1%、演示价格不参与交易，所以固定表既诚实
// 又可复现。要重新锚定就改这些数字。基准 CNY = 1。
export const FX_FROM_BASE: Record<Currency, number> = {
  CNY: 1,
  SGD: 0.19,
  USD: 0.14,
  AUD: 0.21,
  CAD: 0.19,
  EUR: 0.13,
  JPY: 21.9,
  KRW: 190.6,
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
