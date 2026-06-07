// Backfill the merchant_style config (audit findings 2 + 7): give each live style a relational
// catalog breakdown so its price + duration are DERIVED (via quoteService), not the fake flat
// snapshot the assets backfill wrote. Updates rows IN PLACE — preserves status, media, and image.
//
// Requires migrations 0012 + 0013 applied first (description column, merchant_style_item table,
// set_merchant_style_config RPC).
//
// The 35 "Melissa" rows shipped with no recognition data, so we cannot derive a true per-image
// breakdown blind. Until the live catalog-id recognizer lands, each row gets DEFAULT_SELECTIONS;
// curate richer per-style breakdowns in OVERRIDES (keyed by style id) and re-run — it is idempotent.
//
// Usage: npx tsx scripts/configure-merchant-styles.ts [--dry-run]

import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';
import type { CatalogSelection, PricingUnit } from '@/domain/catalog';
import type { MerchantPricingSetting } from '@/domain/merchant';
import type { StyleDiscoveryFacet } from '@/domain/nail';
import { catalogItems } from '@/mock/catalog';
import { resolveEffectivePricing } from '@/domain/pricing-resolver';
import { recognizeStyleConfig } from '@/nail-ai/style-config-recognition';
import { demoMerchantId } from '@/mock/merchants';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketImpl;
}
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Floor breakdown every manicure shares. Honest + derivable ($28 base manicure, 51 min).
const DEFAULT_SELECTIONS: CatalogSelection[] = [{ catalogItemId: 'basic_manicure_service', quantity: 1 }];

// Curated per-style breakdowns. Fill these in as the images are reviewed; anything not listed
// falls back to DEFAULT_SELECTIONS. Example:
//   'style-melissa-img-8249': [
//     { catalogItemId: 'basic_manicure_service', quantity: 1 },
//     { catalogItemId: 'hand_paint_medium', quantity: 10 },
//   ],
const OVERRIDES: Record<string, CatalogSelection[]> = {};

const catalogById = new Map(catalogItems.map((c) => [c.id, c]));
// Demo merchant has no per-item overrides for these art items; basic_manicure resolves via the
// platform default. Derive over the live catalog with no merchant overrides.
const effective = new Map(
  resolveEffectivePricing(catalogItems, []).map((e) => [e.catalogItemId, e]),
);

// Effective pricing in the shape runGlossaryBreakdown expects (it gates which detected items are
// priceable). Mirrors merchant-pricing-service.listSettings over the demo merchant (no overrides).
const merchantSettings: MerchantPricingSetting[] = catalogItems
  .filter((item) => item.billable !== 'no')
  .map((item) => {
    const eff = effective.get(item.id);
    const groupLabelLocalized = item.parentId
      ? (catalogById.get(item.parentId)?.name ?? item.name)
      : item.name;
    return {
      id: item.id,
      name: item.name,
      nameZh: item.nameZh,
      groupLabel: groupLabelLocalized.zh,
      groupLabelLocalized,
      price: (eff?.priceCents ?? 0) / 100,
      duration: eff?.durationMin ?? 0,
      enabled: eff?.enabled ?? false,
    };
  });

const originalsBucket = 'merchant-style-originals';

type StyleRow = {
  id: string;
  merchant_id: string;
  title: string;
  discovery_facets: StyleDiscoveryFacet[] | null;
  media_asset: { original_bucket: string; original_path: string; mime_type: string } | null;
};

async function imageBase64(media: StyleRow['media_asset']): Promise<{ base64: string; mime: string }> {
  if (!media) throw new Error('style has no media asset');
  const bucket = media.original_bucket || originalsBucket;
  const { data, error } = await client.storage.from(bucket).download(media.original_path);
  if (error || !data) throw new Error(`download failed: ${error?.message ?? 'no data'}`);
  const bytes = Buffer.from(await data.arrayBuffer());
  return { base64: bytes.toString('base64'), mime: media.mime_type || 'image/jpeg' };
}

type ResolvedConfig = {
  selections: CatalogSelection[];
  facets: StyleDiscoveryFacet[];
  description: string;
  name: string | null;
};

// AI path: image → recognizeStyleConfig (breakdown + naming) → real selections/facets/name.
// Falls back to OVERRIDES/DEFAULT if the AI returns no priceable selections.
async function resolveAiConfig(style: StyleRow): Promise<ResolvedConfig> {
  const { base64, mime } = await imageBase64(style.media_asset);
  const ai = await recognizeStyleConfig(base64, mime, merchantSettings);
  if (ai.catalogSelections.length === 0) {
    const selections = OVERRIDES[style.id] ?? DEFAULT_SELECTIONS;
    return { selections, facets: style.discovery_facets ?? [], description: describe(selections), name: ai.name || null };
  }
  return { selections: ai.catalogSelections, facets: ai.discoveryFacets, description: ai.description, name: ai.name || null };
}

// Mirror of quoteService's quantity-duration rule (per_finger/per_piece scale). Kept in sync with
// src/lib/services/quote-service.ts.
function durationScalesWithQuantity(unit: PricingUnit): boolean {
  return unit === 'per_finger' || unit === 'per_piece';
}

function deriveSnapshot(selections: CatalogSelection[]): { priceCents: number; durationMin: number } {
  let priceCents = 0;
  let durationMin = 0;
  for (const sel of selections) {
    const eff = effective.get(sel.catalogItemId);
    const item = catalogById.get(sel.catalogItemId);
    if (!eff || !item) throw new Error(`unknown catalog item: ${sel.catalogItemId}`);
    if (eff.source === 'unresolved' || !eff.enabled) {
      throw new Error(`unresolved pricing for ${sel.catalogItemId}`);
    }
    priceCents += eff.priceCents * sel.quantity;
    if (item.affectsBookingDuration === 'yes') {
      durationMin += durationScalesWithQuantity(eff.pricingUnit)
        ? eff.durationMin * sel.quantity
        : eff.durationMin;
    }
  }
  return { priceCents, durationMin };
}

function describe(selections: CatalogSelection[]): string {
  const names = selections.map((s) => catalogById.get(s.catalogItemId)?.nameZh).filter(Boolean);
  return names.length > 0 ? `${names.join(' + ')}美甲` : '美甲';
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const useAi = process.argv.includes('--ai');
  const force = process.argv.includes('--force');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

  const { data: styles, error } = await client
    .from('merchant_style')
    .select('id, merchant_id, title, discovery_facets, media_asset!merchant_style_media_same_merchant_fk(original_bucket, original_path, mime_type)')
    .eq('merchant_id', demoMerchantId)
    .neq('status', 'archived') // archived styles are immutable (0014 guard); never reconfigure them
    .limit(Number.isFinite(limit) ? limit : 1000);
  if (error) throw new Error(`fetch merchant_style failed: ${error.message}`);
  if (!styles || styles.length === 0) {
    console.log('No merchant_style rows found.');
    return;
  }

  // Already-configured styles (have items) are skipped unless --force, so a re-run only retries the
  // ones that failed last time instead of re-spending model calls on all of them.
  const configuredIds = new Set<string>();
  if (!force) {
    const { data: items } = await client.from('merchant_style_item').select('merchant_style_id');
    for (const row of items ?? []) configuredIds.add(row.merchant_style_id as string);
  }

  let configured = 0;
  let aiNamed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of styles as unknown as StyleRow[]) {
    // "Configured" means it has BOTH priced items AND descriptive facets. A style with items but no
    // facets (e.g. an old default/junk config) still needs an AI pass to populate colour/shape/etc.
    const hasFacets = Array.isArray(row.discovery_facets) && row.discovery_facets.length > 0;
    if (configuredIds.has(row.id) && hasFacets) {
      skipped += 1;
      continue;
    }
    // One bad style (AI miss, unresolved pricing, RPC reject) must not halt the batch.
    try {
      const resolved: ResolvedConfig = useAi
        ? await resolveAiConfig(row)
        : (() => {
            const selections = OVERRIDES[row.id] ?? DEFAULT_SELECTIONS;
            return { selections, facets: row.discovery_facets ?? [], description: describe(selections), name: null };
          })();

      const snapshot = deriveSnapshot(resolved.selections);
      const items = resolved.selections.map((sel, index) => ({
        id: `msitem-${row.id}-${sel.catalogItemId}`,
        catalog_item_id: sel.catalogItemId,
        quantity: sel.quantity,
        position: index,
      }));

      if (dryRun) {
        if (configured < 3) {
          console.log(JSON.stringify(
            { id: row.id, name: resolved.name, selections: resolved.selections, price: snapshot.priceCents, dur: snapshot.durationMin, description: resolved.description },
            null, 2,
          ));
        }
        configured += 1;
        continue;
      }

      const { error: rpcError } = await client.rpc('set_merchant_style_config', {
        p_style_id: row.id,
        p_merchant_id: row.merchant_id,
        p_description: resolved.description,
        p_discovery_facets: resolved.facets,
        p_items: items,
        p_preview_price_cents: snapshot.priceCents,
        p_preview_duration_min: snapshot.durationMin,
        p_title: resolved.name ?? '',
      });
      if (rpcError) throw new Error(`set_merchant_style_config failed: ${rpcError.message}`);
      if (resolved.name) aiNamed += 1;
      configured += 1;
    } catch (err) {
      console.error(`[skip] ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      failed += 1;
    }
  }

  console.log(`${dryRun ? '[dry-run] ' : ''}configured: ${configured} (ai-named: ${aiNamed}, failed: ${failed}, skipped-already-configured: ${skipped})`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
