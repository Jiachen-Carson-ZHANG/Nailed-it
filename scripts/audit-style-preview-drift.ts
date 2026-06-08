// Compare stored preview snapshots vs re-quoted catalogBreakdown for every published style.
// Usage: npx tsx scripts/audit-style-preview-drift.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';
import { catalogItems } from '../src/mock/catalog';
import { quoteableStyleSelections, withBaseManicure } from '../src/domain/style-selections';
import { createQuoteService } from '../src/lib/services/quote-service';
import { createMemoryCatalogRepository } from '../src/lib/repositories/memory/catalog-repository';
import { createMemoryMerchantPricingRepository } from '../src/lib/repositories/memory/merchant-pricing-repository';
import { createMemoryStaffItemDurationRepository } from '../src/lib/repositories/memory/scheduling-repository';
import { demoMerchantId } from '../src/mock/merchants';
import { getDefaultSettings } from '../src/data/glossary-settings-store';
import { mergeMerchantPricingIntoDefaults } from '../src/features/merchant/merge-merchant-pricing-settings';
import { glossaryById, glossaryEntries } from '../src/data/glossary';
import { createMemoryRepositoryBundle } from '../src/lib/repositories';
import type { CatalogSelection } from '../src/domain/catalog';
import type { GlossaryBreakdownItem, BreakdownResult } from '../src/domain/nail';
import type { GlossaryEntrySettings } from '../src/data/glossary-settings-store';

/** Minimal client breakdown total (no React) — mirrors buildBreakdownFromConfig in ComponentBreakdownPanel. */
function buildBreakdownFromConfigPure(
  selections: CatalogSelection[],
  facetLabels: string[],
  settings: GlossaryEntrySettings[],
): BreakdownResult {
  const settingsById = new Map(settings.map((s) => [s.id, s]));
  const glossaryByName = new Map(glossaryEntries.map((e) => [e.name_zh, e.id]));
  const ids = new Set(selections.map((s) => s.catalogItemId));
  const merged = [...selections];
  for (const label of facetLabels) {
    const id = glossaryByName.get(label);
    if (id && !ids.has(id)) {
      merged.push({ catalogItemId: id, quantity: 1 });
      ids.add(id);
    }
  }
  const catalogSelections = withBaseManicure(merged);
  const PRICED = new Set(['service_module', 'billable_component']);
  const items: GlossaryBreakdownItem[] = [];
  for (const sel of catalogSelections) {
    const entry = glossaryById.get(sel.catalogItemId);
    if (!entry) continue;
    const s = settingsById.get(sel.catalogItemId);
    const parentEntry = entry.parent_id !== 'na' ? glossaryById.get(entry.parent_id) : undefined;
    items.push({
      mode: 'glossary',
      glossaryId: sel.catalogItemId,
      glossaryType: entry.type as GlossaryBreakdownItem['glossaryType'],
      nameZh: entry.name_zh,
      typeZh: entry.type_zh,
      parentId: entry.parent_id,
      parentNameZh: parentEntry?.name_zh ?? '',
      quantity: sel.quantity,
      unit: s?.unit ?? entry.default_pricing_unit,
      price: s?.price ?? 0,
      duration: s?.duration ?? entry.default_duration_min,
      affectsBookingDuration: entry.affects_booking_duration,
    });
  }
  const priced = items.filter((i) => PRICED.has(i.glossaryType));
  const totalPrice = priced.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalDuration = priced.reduce(
    (sum, i) => sum + (i.glossaryType === 'billable_component' ? i.duration * i.quantity : i.duration),
    0,
  );
  return { items, catalogSelections, totalPrice, totalDuration, mode: 'glossary' };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

type StyleRow = {
  id: string;
  title: string;
  preview_price_cents: number | null;
  preview_duration_min: number | null;
  discovery_facets: { label: string }[] | null;
};

async function loadMerchantPricing() {
  const { data, error } = await client
    .from('merchant_pricing')
    .select('catalog_item_id, price_cents, duration_min, pricing_unit, enabled')
    .eq('merchant_id', demoMerchantId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    merchantId: demoMerchantId,
    catalogItemId: row.catalog_item_id as string,
    priceCents: row.price_cents as number,
    durationMin: row.duration_min as number | null,
    pricingUnit: row.pricing_unit as string,
    enabled: row.enabled as boolean,
  }));
}

async function main(): Promise<void> {
  const { data: styles, error } = await client
    .from('merchant_style')
    .select('id, title, preview_price_cents, preview_duration_min, discovery_facets')
    .eq('merchant_id', demoMerchantId)
    .eq('status', 'published')
    .order('title');
  if (error) throw new Error(error.message);

  const { data: itemRows, error: itemsError } = await client
    .from('merchant_style_item')
    .select('merchant_style_id, catalog_item_id, quantity')
    .order('position');
  if (itemsError) throw new Error(itemsError.message);

  const itemsByStyle = new Map<string, { catalogItemId: string; quantity: number }[]>();
  for (const row of itemRows ?? []) {
    const sid = row.merchant_style_id as string;
    const list = itemsByStyle.get(sid) ?? [];
    list.push({ catalogItemId: row.catalog_item_id as string, quantity: row.quantity as number });
    itemsByStyle.set(sid, list);
  }

  const pricingRows = await loadMerchantPricing();
  const catalogRepo = createMemoryCatalogRepository(catalogItems);
  const pricingRepo = createMemoryMerchantPricingRepository(
    pricingRows.map((row) => ({
      ...row,
      pricingUnit: row.pricingUnit as import('@/domain/catalog').PricingUnit,
    })),
  );
  const quoteService = createQuoteService({
    ...createMemoryRepositoryBundle(),
    catalog: catalogRepo,
    merchantPricing: pricingRepo,
    staffItemDurations: createMemoryStaffItemDurationRepository(),
  });

  const settings = mergeMerchantPricingIntoDefaults(
    pricingRows.map((row) => ({
      id: row.catalogItemId,
      name: { zh: row.catalogItemId, en: row.catalogItemId },
      nameZh: row.catalogItemId,
      groupLabel: '',
      groupLabelLocalized: { zh: '', en: '' },
      price: row.priceCents / 100,
      duration: row.durationMin ?? 0,
      enabled: row.enabled,
    })),
  );
  const rows = (styles ?? []) as StyleRow[];
  const drifts: Array<{
    id: string;
    title: string;
    storedPrice: number;
    storedDur: number;
    quotePrice: number;
    quoteDur: number;
    clientPrice: number;
    clientDur: number;
    itemIds: string[];
  }> = [];

  for (const style of rows) {
    const rawItems = itemsByStyle.get(style.id) ?? [];
    const quoteSelections = withBaseManicure(quoteableStyleSelections(rawItems));
    const facetLabels = (style.discovery_facets ?? []).map((f) => f.label);

    let quotePrice = -1;
    let quoteDur = -1;
    try {
      const quote = await quoteService.buildQuote({ merchantId: demoMerchantId, selections: quoteSelections });
      quotePrice = quote.totalPriceCents;
      quoteDur = quote.totalDurationMin;
    } catch (e) {
      quotePrice = -2;
      quoteDur = -2;
      console.error(`quote failed ${style.id}:`, e instanceof Error ? e.message : e);
    }

    const client = buildBreakdownFromConfigPure(rawItems, facetLabels, settings);
    const clientPrice = Math.round(client.totalPrice * 100);
    const clientDur = client.totalDuration;

    const storedPrice = style.preview_price_cents ?? 0;
    const storedDur = style.preview_duration_min ?? 0;

    if (storedPrice !== quotePrice || storedPrice !== clientPrice || quotePrice !== clientPrice) {
      drifts.push({
        id: style.id,
        title: style.title,
        storedPrice,
        storedDur,
        quotePrice,
        quoteDur,
        clientPrice,
        clientDur,
        itemIds: quoteSelections.map((s) => `${s.catalogItemId}x${s.quantity}`),
      });
    }
  }

  console.log(`published styles: ${rows.length}`);
  console.log(`price mismatches (stored vs quote vs client): ${drifts.length}\n`);

  if (drifts.length === 0) {
    console.log('All published previews match re-quote and client breakdown.');
    return;
  }

  console.log('id | title | stored | quote | client | items');
  for (const d of drifts) {
    console.log(
      `${d.id} | ${d.title.slice(0, 20)} | $${(d.storedPrice / 100).toFixed(2)}/${d.storedDur}m | $${d.quotePrice >= 0 ? (d.quotePrice / 100).toFixed(2) : 'ERR'}/${d.quoteDur}m | $${(d.clientPrice / 100).toFixed(2)}/${d.clientDur}m | ${d.itemIds.join(',')}`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
