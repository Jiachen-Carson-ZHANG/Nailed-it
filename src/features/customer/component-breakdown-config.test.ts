import { describe, expect, it } from 'vitest';
import { catalogItems } from '@/mock/catalog';
import {
  buildBreakdownFromConfig,
  buildBreakdownResult,
  seedStateFromBreakdown,
} from './ComponentBreakdownPanel';
import { getDefaultSettings } from '@/data/glossary-settings-store';

// Regression for the merchant editor showing "no colour configured": the merchant pipeline stores
// colour / shape / length / finish as discovery facets, NOT as priced catalogBreakdown selections.
// buildBreakdownFromConfig must merge those facet labels back into the breakdown so the editor seeds
// them, otherwise a published/re-edited style looks unconfigured.
describe('buildBreakdownFromConfig', () => {
  it('merges descriptive facets (colour) that live outside catalogBreakdown', () => {
    const color = catalogItems.find((item) => item.category === 'color');
    expect(color, 'catalog should have a colour item').toBeDefined();

    const result = buildBreakdownFromConfig(
      [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
      [color!.nameZh],
    );

    // The colour facet is seeded into the breakdown even though it was not a priced selection.
    expect(result.items.some((item) => item.nameZh === color!.nameZh)).toBe(true);
    expect(result.catalogSelections.length).toBeGreaterThan(1);
  });

  it('merges descriptive facets when the merchant editor stores English facet labels', () => {
    const color = catalogItems.find((item) => item.category === 'color' && item.name.en);
    expect(color, 'catalog should have a colour item with English name').toBeDefined();

    const result = buildBreakdownFromConfig(
      [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
      [color!.name.en],
    );

    expect(result.items.some((item) => item.glossaryId === color!.id)).toBe(true);
    expect(result.catalogSelections).toContainEqual({ catalogItemId: color!.id, quantity: 1 });
  });

  it('does not re-inject omitted billable_component facets back into catalogBreakdown', () => {
    const result = buildBreakdownFromConfig(
      [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
      ['建构'],
    );

    expect(result.catalogSelections).not.toContainEqual({ catalogItemId: 'builder_gel', quantity: 1 });
    expect(result.items.some((item) => item.glossaryId === 'builder_gel')).toBe(false);
  });

  it('keeps the original priced selections', () => {
    const result = buildBreakdownFromConfig(
      [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
      [],
    );
    expect(result.catalogSelections).toEqual([{ catalogItemId: 'basic_manicure_service', quantity: 1 }]);
  });

  it('injects base manicure so editor totals match library preview snapshots', () => {
    const result = buildBreakdownFromConfig(
      [{ catalogItemId: 'builder_gel', quantity: 1 }],
      ['纯色'],
    );

    expect(result.items.some((item) => item.glossaryId === 'basic_manicure_service')).toBe(true);
    expect(result.items.some((item) => item.glossaryId === 'builder_gel')).toBe(true);
    // Catalog defaults: basic $28 + builder $15 = $43 (solid color is included / $0).
    expect(result.totalPrice).toBe(43);
    expect(result.catalogSelections[0]).toEqual({ catalogItemId: 'basic_manicure_service', quantity: 1 });
  });

  it('re-seeding chip state preserves preview totals (no phantom builder_gel, per-finger qty)', () => {
    const stored = [
      { catalogItemId: 'basic_manicure_service', quantity: 1 },
      { catalogItemId: 'glitter', quantity: 1 },
      { catalogItemId: 'french_tip_special', quantity: 1 },
      { catalogItemId: 'hand_paint_simple', quantity: 3 },
      { catalogItemId: 'removal_basic_gel', quantity: 1 },
    ];
    const settingsById = new Map(getDefaultSettings().map((s) => [s.id, s]));
    const cached = buildBreakdownFromConfig(stored, ['透色', '杏仁形']);
    expect(cached.totalPrice).toBe(88);

    const chip = seedStateFromBreakdown(cached);
    expect(chip.structureIds.has('builder_gel')).toBe(false);
    expect(chip.quantities.get('hand_paint_simple')).toBe(3);

    const rebuilt = buildBreakdownResult(
      chip.removalId,
      chip.structureIds,
      chip.nailShape,
      chip.nailLength,
      chip.texture,
      chip.colorIds,
      chip.colorEffectIds,
      chip.artIds,
      chip.decoIds,
      chip.quantities,
      settingsById,
    );
    expect(rebuilt.totalPrice).toBe(88);
    expect(rebuilt.totalDuration).toBe(cached.totalDuration);
  });

  it('hydrates extension recognition with only explicitly selected structure chips', () => {
    const settingsById = new Map(getDefaultSettings().map((s) => [s.id, s]));
    const recognized = buildBreakdownResult(
      null,
      new Set(['nail_tip_full_cover']),
      null,
      null,
      null,
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Map(),
      settingsById,
    );

    const chip = seedStateFromBreakdown(recognized);

    expect(chip.structureIds.has('nail_tip_full_cover')).toBe(true);
    expect(chip.structureIds.has('builder_gel')).toBe(false);
    expect(chip.structureIds.has('nail_tip_half_cover')).toBe(false);
  });

  it('does not reserialize full-cover into the priced breakdown as extra items', () => {
    const settingsById = new Map(getDefaultSettings().map((s) => [s.id, s]));
    const recognized = buildBreakdownResult(
      null,
      new Set(['nail_tip_full_cover']),
      null,
      null,
      null,
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Map(),
      settingsById,
    );

    const chip = seedStateFromBreakdown(recognized);
    const rebuilt = buildBreakdownResult(
      chip.removalId,
      chip.structureIds,
      chip.nailShape,
      chip.nailLength,
      chip.texture,
      chip.colorIds,
      chip.colorEffectIds,
      chip.artIds,
      chip.decoIds,
      chip.quantities,
      settingsById,
    );

    expect(rebuilt.catalogSelections).toEqual(recognized.catalogSelections);
    expect(rebuilt.totalPrice).toBe(recognized.totalPrice);
  });

  it('hydrates legacy finish_service items as color effects instead of hidden texture state', () => {
    const settingsById = new Map(getDefaultSettings().map((s) => [s.id, s]));
    const recognized = buildBreakdownResult(
      null,
      new Set(),
      null,
      null,
      'matte_top',
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Map(),
      settingsById,
    );

    const chip = seedStateFromBreakdown(recognized);
    expect(chip.texture).toBeNull();
    expect(chip.colorEffectIds.has('matte_top')).toBe(true);
  });

  it('preserves pure texture round-trip serialization contract', () => {
    const settingsById = new Map(getDefaultSettings().map((s) => [s.id, s]));
    const recognized = buildBreakdownResult(
      null,
      new Set(),
      'shape_almond',
      'length_short',
      'texture_matte',
      new Set(['color_nude']),
      new Set(),
      new Set(),
      new Set(),
      new Map(),
      settingsById,
    );

    const chip = seedStateFromBreakdown(recognized);
    expect(chip.texture).toBe('texture_matte');

    const rebuilt = buildBreakdownResult(
      chip.removalId,
      chip.structureIds,
      chip.nailShape,
      chip.nailLength,
      chip.texture,
      chip.colorIds,
      chip.colorEffectIds,
      chip.artIds,
      chip.decoIds,
      chip.quantities,
      settingsById,
    );

    expect(rebuilt.catalogSelections).toContainEqual({ catalogItemId: 'texture_matte', quantity: 1 });
    expect(rebuilt.items.some((item) => item.glossaryId === 'texture_matte')).toBe(true);
  });
});
