import { describe, expect, it } from 'vitest';
import {
  aiDetectableValues,
  catalogItemTypes,
  durationConfigLevels,
  pricingUnits,
  triStates,
  yesNoValues
} from '@/domain/catalog';
import { createMemoryCatalogRepository } from '@/lib/repositories/memory/catalog-repository';
import { createMemoryMerchantPricingRepository } from '@/lib/repositories/memory/merchant-pricing-repository';
import type { RepositoryBundle } from '@/lib/repositories/types';
import { createMerchantPricingService } from '@/lib/services/merchant-pricing-service';
import { catalogItems } from './catalog';

describe('catalog data integrity', () => {
  it('has unique ids', () => {
    const ids = catalogItems.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every parentId references an existing item or is null', () => {
    const ids = new Set(catalogItems.map((i) => i.id));
    const orphans = catalogItems.filter((i) => i.parentId !== null && !ids.has(i.parentId));
    expect(orphans.map((i) => i.id)).toEqual([]);
  });

  it('every enum field holds a valid value', () => {
    const bad: string[] = [];
    for (const i of catalogItems) {
      if (!catalogItemTypes.includes(i.type)) bad.push(`${i.id}.type=${i.type}`);
      if (!aiDetectableValues.includes(i.aiDetectable)) bad.push(`${i.id}.aiDetectable=${i.aiDetectable}`);
      if (!durationConfigLevels.includes(i.durationConfigLevel)) bad.push(`${i.id}.durationConfigLevel=${i.durationConfigLevel}`);
      if (!yesNoValues.includes(i.userVisible)) bad.push(`${i.id}.userVisible=${i.userVisible}`);
      if (!yesNoValues.includes(i.complexitySupported)) bad.push(`${i.id}.complexitySupported=${i.complexitySupported}`);
      for (const [k, v] of [
        ['billable', i.billable],
        ['merchantPriceRequired', i.merchantPriceRequired],
        ['merchantDurationRequired', i.merchantDurationRequired],
        ['affectsBookingDuration', i.affectsBookingDuration],
        ['quantitySupported', i.quantitySupported]
      ] as const) {
        if (!triStates.includes(v)) bad.push(`${i.id}.${k}=${v}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('defaultPricingUnit is always within allowedPricingUnits, and all units are valid', () => {
    const bad: string[] = [];
    for (const i of catalogItems) {
      if (i.allowedPricingUnits.length === 0) bad.push(`${i.id} has no allowed units`);
      for (const u of i.allowedPricingUnits) {
        if (!pricingUnits.includes(u)) bad.push(`${i.id} allowed has invalid unit ${u}`);
      }
      if (!pricingUnits.includes(i.defaultPricingUnit)) bad.push(`${i.id} invalid default unit ${i.defaultPricingUnit}`);
      if (!i.allowedPricingUnits.includes(i.defaultPricingUnit)) {
        bad.push(`${i.id} default ${i.defaultPricingUnit} not in allowed ${JSON.stringify(i.allowedPricingUnits)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('items that affect booking duration carry a non-negative default duration', () => {
    const bad = catalogItems.filter(
      (i) => i.affectsBookingDuration === 'yes' && (typeof i.defaultDurationMin !== 'number' || i.defaultDurationMin < 0)
    );
    expect(bad.map((i) => i.id)).toEqual([]);
  });
});

describe('catalog bilingual content', () => {
  it('uses required bilingual names as the canonical contract for every catalog item', () => {
    for (const item of catalogItems) {
      expect(item.name.zh).not.toBe('');
      expect(item.name.en).not.toBe('');
      expect(item.name.zh).toBe(item.nameZh);
    }
  });

  it('uses required bilingual notes while keeping legacy notes stable', () => {
    for (const item of catalogItems) {
      expect(item.notesLocalized.zh).toBe(item.notes);
      expect(item.notesLocalized.zh).not.toBe('');
      expect(item.notesLocalized.en).not.toBe('');
    }
  });
});

describe('merchant pricing localized display records', () => {
  it('returns localized names and group labels while keeping legacy Chinese labels stable', async () => {
    const repos = {
      catalog: createMemoryCatalogRepository(catalogItems),
      merchantPricing: createMemoryMerchantPricingRepository(),
    } as RepositoryBundle;

    const settings = await createMerchantPricingService(repos).listSettings('merchant-1');
    const removalBasicGel = settings.find((item) => item.id === 'removal_basic_gel');
    const basicService = settings.find((item) => item.id === 'basic_manicure_service');

    expect(removalBasicGel?.name).toEqual({
      zh: '卸非光疗本甲',
      en: 'Removal basic gel',
    });
    expect(removalBasicGel?.groupLabelLocalized).toEqual({
      zh: '卸甲服务',
      en: 'Removal service',
    });
    expect(removalBasicGel?.groupLabel).toBe('卸甲服务');

    expect(basicService?.name).toEqual({
      zh: '基础护理服务',
      en: 'Basic manicure service',
    });
    expect(basicService?.groupLabelLocalized).toEqual({
      zh: '基础护理服务',
      en: 'Basic manicure service',
    });
    expect(basicService?.nameZh).toBe('基础护理服务');
  });
});
