import type { AppLanguage, BookingStatusLabel, PricingUnitLabel } from './types';
import { DEFAULT_CURRENCY, FX_FROM_SGD, type Currency } from '@/data/currency-store';

type WithLanguage = { language: AppLanguage };

type CurrencyInput = { cents: number; language?: AppLanguage; currency?: Currency };
type DurationInput = WithLanguage & { minutes: number };
type UnitLabelInput = WithLanguage & { unit: PricingUnitLabel };
type StatusLabelInput = WithLanguage & { status: BookingStatusLabel };

type LanguageTextMap = Record<AppLanguage, string>;

const durationSuffixes: LanguageTextMap = {
  'zh-CN': ' 分钟',
  en: ' min',
};

const pricingUnitLabels: Record<PricingUnitLabel, LanguageTextMap> = {
  per_finger: { 'zh-CN': '每指', en: 'per finger' },
};

const statusLabels: Record<BookingStatusLabel, LanguageTextMap> = {
  pending_review: { 'zh-CN': '待确认', en: 'Pending review' },
  confirmed: { 'zh-CN': '已确认', en: 'Confirmed' },
  in_progress: { 'zh-CN': '进行中', en: 'In progress' },
  completed: { 'zh-CN': '已完成', en: 'Completed' },
  cancelled: { 'zh-CN': '已取消', en: 'Cancelled' },
};

/**
 * Format money in the merchant/customer's chosen display currency. Stored `cents` are SGD (the catalog
 * base); we CONVERT with the frozen `FX_FROM_SGD` table (not just relabel) and format with
 * `Intl.NumberFormat`, so the symbol and decimal places are correct per currency (JPY/KRW show no
 * decimals, ¥/$/€ get their symbol). Falls back to a plain `CODE 12.34` string if a runtime lacks the
 * currency's ICU data.
 */
export function formatCurrency({ cents, currency, language }: CurrencyInput) {
  const ccy = currency ?? DEFAULT_CURRENCY;
  const amount = (cents / 100) * (FX_FROM_SGD[ccy] ?? 1);
  const locale = language === 'zh-CN' ? 'zh-CN' : language === 'en' ? 'en' : undefined;
  try {
    // Intl separates the code/symbol from the number with a non-breaking space (U+00A0/U+202F). Normalize
    // to a plain space so output stays byte-identical to the historical `SGD 12.34` form (keeps existing
    // assertions + any copy comparisons stable) while gaining the symbol + per-currency decimals.
    return new Intl.NumberFormat(locale, { style: 'currency', currency: ccy })
      .format(amount)
      .replace(/[\u00a0\u202f]/g, ' ');
  } catch {
    return `${ccy} ${amount.toFixed(2)}`;
  }
}

export function formatDuration({ minutes, language }: DurationInput) {
  return `${minutes}${durationSuffixes[language]}`;
}

export function formatPricingUnitLabel({ unit, language }: UnitLabelInput) {
  return pricingUnitLabels[unit][language];
}

export function formatStatusLabel({ status, language }: StatusLabelInput) {
  return statusLabels[status][language];
}
