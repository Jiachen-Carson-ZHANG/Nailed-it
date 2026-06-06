// Generate src/mock/catalog.ts from the Lark "Dictionary" sheet (exported as CSV).
// Catalog is the platform source of truth (ADR-0005). The DB CHECK constraints (migration 0002 +
// 0011) and the catalog integrity test mirror these values, so this generator VALIDATES hard and
// throws on any inconsistency rather than emitting data the test/DB would reject.
//
// Usage: node scripts/generate-catalog.mjs "/path/to/Dictionary - Sheet1.csv"
// Default path is the most recent Lark export in the Windows Downloads folder.
//
// Notes on the sheet schema (2026-06-06): the `pricing_units` allowed-list column was dropped — only
// `default_pricing_unit` remains, so allowedPricingUnits is generated as the single default unit.
// `default_price` (dollars, blank = no platform default) is new and becomes defaultPriceCents.

import { readFileSync, writeFileSync } from 'node:fs';

const CSV = process.argv[2] ?? '/mnt/c/Users/tough/Downloads/Dictionary - Sheet1.csv';
const OUT = new URL('../src/mock/catalog.ts', import.meta.url);

const TYPES = ['service_module', 'procedure', 'billable_component', 'visual_attribute', 'complexity_level', 'style_tag'];
const AI = ['yes', 'no', 'weak', 'user_confirmed'];
const TRI = ['yes', 'no', 'optional'];
const YN = ['yes', 'no'];
const DCL = ['platform_default', 'merchant_optional', 'merchant_level', 'staff_level', 'none'];
const UNITS = ['fixed', 'included', 'per_finger', 'per_level', 'per_piece', 'per_set', 'tag_only'];

const raw = readFileSync(CSV, 'utf8').replace(/^﻿/, '');
const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
const header = lines[0].split(',').map((h) => h.trim());
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const rows = lines.slice(1).map((l) => l.split(','));
const cell = (r, name) => (r[idx[name]] ?? '').trim();
const normUnit = (s) => s.trim().replace(/\s+/g, '_');

const errors = [];
const ids = new Set();
const items = [];

for (const r of rows) {
  const id = cell(r, 'id');
  if (ids.has(id)) errors.push(`duplicate id: ${id}`);
  ids.add(id);

  const parentRaw = cell(r, 'parent_id');
  const parentId = parentRaw === '' || parentRaw.toLowerCase() === 'na' || parentRaw.toLowerCase() === 'null' ? null : parentRaw;

  // "na" / blank both mean "not applicable" (descriptive tags carry no duration/price).
  const isBlank = (v) => v === '' || v.toLowerCase() === 'na';
  const durRaw = cell(r, 'default_duration_min');
  const defaultDurationMin = isBlank(durRaw) ? null : Number(durRaw);

  const priceRaw = cell(r, 'default_price');
  const defaultPriceCents = isBlank(priceRaw) ? null : Math.round(Number(priceRaw) * 100);

  const defaultPricingUnit = normUnit(cell(r, 'default_pricing_unit'));
  // The sheet no longer ships an allowed-units list; the default is the single allowed unit.
  const allowedPricingUnits = [defaultPricingUnit];

  const item = {
    id,
    nameZh: cell(r, 'name_zh'),
    type: cell(r, 'type'),
    category: cell(r, 'category'),
    parentId,
    userVisible: cell(r, 'user_visible'),
    aiDetectable: cell(r, 'ai_detectable'),
    billable: cell(r, 'billable'),
    merchantPriceRequired: cell(r, 'merchant_price_required'),
    merchantDurationRequired: cell(r, 'merchant_duration_required'),
    durationConfigLevel: cell(r, 'duration_config_level'),
    affectsBookingDuration: cell(r, 'affects_booking_duration'),
    defaultDurationMin,
    allowedPricingUnits,
    defaultPricingUnit,
    defaultPriceCents,
    quantitySupported: cell(r, 'quantity_supported'),
    complexitySupported: cell(r, 'complexity_supported'),
    notes: cell(r, 'notes'),
  };

  // Hard validation (mirrors the integrity test + DB CHECKs).
  if (!TYPES.includes(item.type)) errors.push(`${id}.type=${item.type}`);
  if (!AI.includes(item.aiDetectable)) errors.push(`${id}.aiDetectable=${item.aiDetectable}`);
  if (!DCL.includes(item.durationConfigLevel)) errors.push(`${id}.durationConfigLevel=${item.durationConfigLevel}`);
  if (!YN.includes(item.userVisible)) errors.push(`${id}.userVisible=${item.userVisible}`);
  if (!YN.includes(item.complexitySupported)) errors.push(`${id}.complexitySupported=${item.complexitySupported}`);
  for (const [k, v] of [['billable', item.billable], ['merchantPriceRequired', item.merchantPriceRequired], ['merchantDurationRequired', item.merchantDurationRequired], ['affectsBookingDuration', item.affectsBookingDuration], ['quantitySupported', item.quantitySupported]]) {
    if (!TRI.includes(v)) errors.push(`${id}.${k}=${v}`);
  }
  if (!UNITS.includes(item.defaultPricingUnit)) errors.push(`${id}.defaultPricingUnit=${item.defaultPricingUnit}`);
  if (item.defaultDurationMin !== null && (!Number.isFinite(item.defaultDurationMin) || item.defaultDurationMin < 0)) errors.push(`${id}.defaultDurationMin=${durRaw}`);
  if (item.defaultPriceCents !== null && (!Number.isFinite(item.defaultPriceCents) || item.defaultPriceCents < 0)) errors.push(`${id}.default_price=${priceRaw}`);
  if (item.affectsBookingDuration === 'yes' && (item.defaultDurationMin === null || !Number.isFinite(item.defaultDurationMin))) errors.push(`${id} affects booking duration but has no default_duration_min`);

  items.push(item);
}

// parent integrity
for (const it of items) {
  if (it.parentId !== null && !ids.has(it.parentId)) errors.push(`${it.id}: parentId ${it.parentId} not found`);
}

if (errors.length) {
  console.error(`REFUSING to generate — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const body = items.map((it) => '  ' + JSON.stringify(it, null, 2).replace(/\n/g, '\n  ')).join(',\n');
const out = `// AUTO-GENERATED from the Lark "Dictionary" sheet via scripts/generate-catalog.mjs.
// Catalog source of truth (ADR-0005). Do not edit by hand — edit the sheet and regenerate.
import type { CatalogItem } from '@/domain/catalog';

export const catalogItems: CatalogItem[] = [
${body}
];
`;

writeFileSync(OUT, out);
console.log(`Wrote ${items.length} catalog items to src/mock/catalog.ts`);
const priced = items.filter((i) => i.defaultPriceCents !== null).length;
console.log(`  priced (defaultPriceCents != null): ${priced} | unpriced: ${items.length - priced}`);
