import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDuration,
  formatPricingUnitLabel,
  formatStatusLabel,
} from '@/i18n/format';

describe('formatCurrency', () => {
  it('always formats as SGD regardless of UI language', () => {
    expect(formatCurrency({ cents: 12345, language: 'zh-CN' })).toBe('SGD 123.45');
    expect(formatCurrency({ cents: 12345, language: 'en' })).toBe('SGD 123.45');
  });
});

describe('formatDuration', () => {
  it('formats zh-CN duration', () => {
    expect(formatDuration({ minutes: 45, language: 'zh-CN' })).toBe('45 分钟');
  });

  it('formats English duration', () => {
    expect(formatDuration({ minutes: 45, language: 'en' })).toBe('45 min');
  });
});

describe('formatPricingUnitLabel', () => {
  it('formats per_finger labels', () => {
    expect(formatPricingUnitLabel({ unit: 'per_finger', language: 'zh-CN' })).toBe('每指');
    expect(formatPricingUnitLabel({ unit: 'per_finger', language: 'en' })).toBe('per finger');
  });
});

describe('formatStatusLabel', () => {
  it('formats pending_review labels', () => {
    expect(formatStatusLabel({ status: 'pending_review', language: 'zh-CN' })).toBe('待确认');
    expect(formatStatusLabel({ status: 'pending_review', language: 'en' })).toBe('Pending review');
  });
});
