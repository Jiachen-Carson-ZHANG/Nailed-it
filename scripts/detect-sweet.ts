// One-off: run the real recognition pipeline on the new 甜美 (sweet*.jpg) pictures and print the
// AI's discovery facets, WITHOUT writing anything to the library. Review-first: we want to see if
// the model tags them 甜美 before connecting them to the customer-facing source library.
//
// Usage: npx tsx scripts/detect-sweet.ts

import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { catalogItems } from '@/mock/catalog';
import { resolveEffectivePricing } from '@/domain/pricing-resolver';
import { recognizeStyleConfig } from '@/nail-ai/style-config-recognition';

const effective = new Map(
  resolveEffectivePricing(catalogItems, []).map((e) => [e.catalogItemId, e]),
);

// Same effective-pricing shape runGlossaryBreakdown expects (mirrors configure-merchant-styles.ts).
const merchantSettings = catalogItems
  .filter((item) => item.billable !== 'no')
  .map((item) => {
    const eff = effective.get(item.id);
    return {
      id: item.id,
      nameZh: item.nameZh,
      groupLabel: item.parentId ?? item.category,
      price: (eff?.priceCents ?? 0) / 100,
      duration: eff?.durationMin ?? 0,
      enabled: eff?.enabled ?? false,
    };
  });

const IMAGES = ['sweet1.jpg', 'sweet2.jpg', 'sweet3.jpg'];

async function main() {
  for (const file of IMAGES) {
    const abs = path.join('nail_assets', file);
    const bytes = await readFile(abs);
    const base64 = bytes.toString('base64');
    console.log(`\n=== ${file} ===`);
    try {
      const ai = await recognizeStyleConfig(base64, 'image/jpeg', merchantSettings);
      const labels = ai.discoveryFacets.map((f) => f.label);
      console.log('name       :', ai.name);
      console.log('description:', ai.description);
      console.log('facets     :', labels.join(' · '));
      console.log('甜美?       :', labels.includes('甜美') ? 'YES ✅' : 'NO ❌');
    } catch (error) {
      console.log('FAILED:', error instanceof Error ? error.message : error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
