import { describe, expect, it } from 'vitest';
import type { MerchantPricingSetting } from '@/domain/merchant';
import {
  breakdownResponseFormat,
  parseBreakdownModelOutput,
} from './breakdown';

const settings: MerchantPricingSetting[] = [
  {
    id: 'cat_eye',
    nameZh: '猫眼色',
    groupLabel: '色彩效果',
    price: 10,
    duration: 20,
    enabled: true,
  },
  {
    id: 'gradient',
    nameZh: '渐变',
    groupLabel: '色彩效果',
    price: 5,
    duration: 20,
    enabled: true,
  },
  {
    id: 'jelly_translucent',
    nameZh: '透色',
    groupLabel: '色彩效果',
    price: 2,
    duration: 15,
    enabled: true,
  },
];

function validOutput() {
  return {
    service_modules: [],
    billable_components: [
      { id: 'cat_eye', quantity: 8, unit: 'set' },
      { id: 'gradient', quantity: 3, unit: 'finger' },
    ],
    procedures: [],
    visual_attributes: [],
    complexity_level: [],
    style_tags: [],
  };
}

describe('parseBreakdownModelOutput', () => {
  it('requires every section instead of silently treating missing sections as empty', () => {
    const { style_tags: _removed, ...missingSection } = validOutput();
    expect(() => parseBreakdownModelOutput(missingSection, settings)).toThrow('invalid_model_output');
  });

  it('rejects malformed items and ids placed in the wrong section', () => {
    expect(() =>
      parseBreakdownModelOutput(
        { ...validOutput(), billable_components: [{ id: 'cat_eye', quantity: 'many', unit: 'set' }] },
        settings,
      ),
    ).toThrow('invalid_model_output');

    expect(() =>
      parseBreakdownModelOutput(
        { ...validOutput(), procedures: [{ id: 'cat_eye', quantity: 1, unit: 'set' }] },
        settings,
      ),
    ).toThrow('invalid_model_output');
  });

  it('forces per-set quantities to one and preserves quantity-bearing units', () => {
    const result = parseBreakdownModelOutput(validOutput(), settings);
    expect(result.catalogSelections).toEqual([
      { catalogItemId: 'cat_eye', quantity: 1 },
      { catalogItemId: 'gradient', quantity: 3 },
    ]);
    expect(result.items.find((item) => item.glossaryId === 'cat_eye')?.quantity).toBe(1);
    expect(result.items.find((item) => item.glossaryId === 'gradient')?.quantity).toBe(3);
  });

  it('keeps enabled merchant-priced selections even when the catalog has no default price', () => {
    const output = validOutput();
    output.billable_components.push({ id: 'jelly_translucent', quantity: 1, unit: 'set' });
    expect(parseBreakdownModelOutput(output, settings).catalogSelections).toContainEqual({
      catalogItemId: 'jelly_translucent',
      quantity: 1,
    });
  });

  it('injects the base manicure floor (ai_detectable=no) so the quote is never $0', () => {
    const withBase: MerchantPricingSetting[] = [
      ...settings,
      { id: 'basic_manicure_service', nameZh: '基础护理服务', groupLabel: '基础', price: 28, duration: 51, enabled: true },
    ];
    const result = parseBreakdownModelOutput(validOutput(), withBase);
    expect(result.catalogSelections).toContainEqual({ catalogItemId: 'basic_manicure_service', quantity: 1 });
    expect(result.items.some((item) => item.glossaryId === 'basic_manicure_service')).toBe(true);
  });

  it('declares a strict JSON-schema response contract', () => {
    expect(breakdownResponseFormat.type).toBe('json_schema');
    expect(breakdownResponseFormat.json_schema.strict).toBe(true);
  });
});
