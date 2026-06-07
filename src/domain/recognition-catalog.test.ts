import { describe, expect, it } from 'vitest';
import { glossaryById } from '@/data/glossary';
import { catalogItems } from '@/mock/catalog';
import {
  aiDetectableCatalogItems,
  bucketRecognition,
  recognitionConfidenceThreshold,
  toCatalogSelections,
  type RecognizedCatalogItem,
} from './recognition-catalog';

const YES = 'extension_service'; // aiDetectable yes
const YES2 = 'art_service'; // aiDetectable yes
const WEAK = 'builder_service'; // aiDetectable weak
const USER = 'removal_service'; // aiDetectable user_confirmed
const NO = 'basic_manicure_service'; // aiDetectable no

function raw(catalogItemId: string, confidence: number, quantity = 1): RecognizedCatalogItem {
  return { catalogItemId, confidence, quantity };
}

describe('aiDetectableCatalogItems', () => {
  it('keeps everything except aiDetectable="no"', () => {
    const subset = aiDetectableCatalogItems(catalogItems);
    expect(subset.every((item) => item.aiDetectable !== 'no')).toBe(true);
    expect(subset).toHaveLength(catalogItems.filter((item) => item.aiDetectable !== 'no').length);
    expect(subset.some((item) => item.id === NO)).toBe(false);
  });
});

describe('bucketRecognition', () => {
  it('routes a high-confidence detectable item to detected', () => {
    const { detected, uncertain } = bucketRecognition([raw(YES, 0.95)], catalogItems);
    expect(detected.map((i) => i.catalogItemId)).toEqual([YES]);
    expect(uncertain).toEqual([]);
  });

  it('forces weak and user_confirmed items to uncertain even at high confidence', () => {
    const { detected, uncertain } = bucketRecognition([raw(WEAK, 0.99), raw(USER, 0.99)], catalogItems);
    expect(detected).toEqual([]);
    expect(uncertain.map((i) => i.catalogItemId).sort()).toEqual([USER, WEAK].sort());
  });

  it('routes low-confidence and non-finite-confidence items to uncertain (fail closed)', () => {
    const { detected, uncertain } = bucketRecognition([raw(YES, 0.4), raw(YES2, Number.NaN)], catalogItems);
    expect(detected).toEqual([]);
    expect(uncertain.map((i) => i.catalogItemId).sort()).toEqual([YES, YES2].sort());
  });

  it('treats confidence exactly at the threshold as detected', () => {
    const { detected } = bucketRecognition([raw(YES, recognitionConfidenceThreshold)], catalogItems);
    expect(detected.map((i) => i.catalogItemId)).toEqual([YES]);
  });

  it('drops unknown ids and aiDetectable="no" ids the model must not emit', () => {
    const { detected, uncertain } = bucketRecognition(
      [raw('does-not-exist', 0.99), raw(NO, 0.99)],
      catalogItems,
    );
    expect(detected).toEqual([]);
    expect(uncertain).toEqual([]);
  });

  it('normalizes a non-positive quantity to 1', () => {
    const { detected } = bucketRecognition([raw(YES, 0.95, 0)], catalogItems);
    expect(detected[0].quantity).toBe(1);
  });

  it('treats Infinity confidence as not-confident (uncertain), not detected', () => {
    const { detected, uncertain } = bucketRecognition([raw(YES, Number.POSITIVE_INFINITY)], catalogItems);
    expect(detected).toEqual([]);
    expect(uncertain.map((i) => i.catalogItemId)).toEqual([YES]);
    expect(Number.isFinite(uncertain[0].confidence)).toBe(true);
  });

  it('coerces a string quantity from untrusted JSON to 1', () => {
    const malformed = { catalogItemId: YES, confidence: 0.95, quantity: '2' } as unknown as RecognizedCatalogItem;
    const { detected } = bucketRecognition([malformed], catalogItems);
    expect(detected[0].quantity).toBe(1);
    expect(typeof detected[0].quantity).toBe('number');
  });

  it('rejects a fractional quantity, falling back to 1', () => {
    const { detected } = bucketRecognition([raw(YES, 0.95, 2.5)], catalogItems);
    expect(detected[0].quantity).toBe(1);
  });

  it('coerces a string confidence from untrusted JSON to uncertain', () => {
    const malformed = { catalogItemId: YES, confidence: '0.95', quantity: 1 } as unknown as RecognizedCatalogItem;
    const { detected, uncertain } = bucketRecognition([malformed], catalogItems);
    expect(detected).toEqual([]);
    expect(uncertain.map((i) => i.catalogItemId)).toEqual([YES]);
  });
});

describe('toCatalogSelections', () => {
  const recognition = bucketRecognition(
    [
      { catalogItemId: YES, confidence: 0.95, quantity: 1 },
      { catalogItemId: YES, confidence: 0.95, quantity: 2 }, // same id again — quantities merge
      { catalogItemId: WEAK, confidence: 0.95, quantity: 1 }, // uncertain (weak)
    ],
    catalogItems,
  );

  it('includes detected items and merges duplicate quantities, excluding unconfirmed uncertain', () => {
    expect(toCatalogSelections(recognition)).toEqual([{ catalogItemId: YES, quantity: 3 }]);
  });

  it('includes an uncertain item once the user confirms it', () => {
    const selections = toCatalogSelections(recognition, [WEAK]);
    expect(selections).toContainEqual({ catalogItemId: YES, quantity: 3 });
    expect(selections).toContainEqual({ catalogItemId: WEAK, quantity: 1 });
  });
});

describe('glossary bilingual content', () => {
  it('derives localized names and localized type labels from catalog data', () => {
    const basic = glossaryById.get('basic_manicure_service');
    expect(basic?.name.zh).toBe('基础护理服务');
    expect(basic?.name.en).toBe('Basic manicure service');
    expect(basic?.typeLabel.zh).toBe('服务模块');
    expect(basic?.typeLabel.en).toBe('Service module');
  });
});
