import type { AppLanguage, BookingStatusLabel, PricingUnitLabel } from './types';
import { DISPLAY_CURRENCY } from '@/data/currency-store';

type WithLanguage = { language: AppLanguage };

type CurrencyInput = { cents: number; language?: AppLanguage };
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

/** Format money as `SGD 12.34` — language does not change the currency code or symbol. */
export function formatCurrency({ cents }: CurrencyInput) {
  const amount = (cents / 100).toFixed(2);
  return `${DISPLAY_CURRENCY} ${amount}`;
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
