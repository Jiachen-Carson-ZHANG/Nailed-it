// Demo preflight (audit 2026-06-27 #5). Hits the RUNNING app's agent endpoints — the exact view the
// agents see — and prints the demo-critical values with PASS/FAIL bands. Run right before the demo
// (after seed:intelligence + seed:agents) to catch stale data (wall-clock windows, missing fillers,
// the 暗黑 gap, 金属感 rising, 8284 low-conv, 8265 top converter).
//
//   npm run dev   # in another terminal
//   npx tsx scripts/preflight-demo.ts   (or: npm run preflight)

import { getPlatformHotTags } from '@/domain/intelligence';

const APP = process.env.NAILED_APP_URL ?? 'http://localhost:3000';

type StyleRow = { id: string; title: string; merchantId: string; tags: string[] };

let pass = true;
const check = (label: string, ok: boolean, detail: string) => {
  if (!ok) pass = false;
  console.log(`  ${ok ? '✅' : '❌'} ${label}: ${detail}`);
};

async function main() {
  const [briefing, stylesResp] = await Promise.all([
    fetch(`${APP}/api/agent/briefing?rangeDays=7`).then((r) => r.json()),
    fetch(`${APP}/api/agent/styles`).then((r) => r.json()),
  ]);
  const insights = briefing.insights ?? {};
  const styles: StyleRow[] = stylesResp.styles ?? [];

  console.log('\n— Catalog / merchants —');
  const byMerchant = new Map<string, number>();
  for (const s of styles) byMerchant.set(s.merchantId, (byMerchant.get(s.merchantId) ?? 0) + 1);
  check('merchants', byMerchant.size >= 1, `${byMerchant.size} (${[...byMerchant.entries()].map(([m, n]) => `${m}:${n}`).join(', ')})`);
  check('multi-merchant feed', byMerchant.size >= 2, byMerchant.size >= 2 ? 'fillers present' : 'ONLY hero — fillers not seeded to this DB');

  console.log('\n— Demand / trends —');
  const metal = (insights.demandTrends ?? []).find((t: { label: string }) => t.label === '金属感');
  check('金属感 rising', metal?.direction === 'up', metal ? `${metal.direction} (cur ${metal.current} vs prev ${metal.previous})` : 'no 金属感 trend');
  const gap = (insights.catalogGaps ?? []).find((g: { label: string }) => g.label === '暗黑');
  check('暗黑 gap', !!gap, gap ? `search ${gap.searchCount}, supply ${gap.matchingActiveStyles}` : 'no 暗黑 gap surfaced');

  console.log('\n— Design performance —');
  const perf = insights.designPerformance ?? {};
  const lc = (perf.highInterestLowConversion ?? []).find((s: { styleId: string }) => s.styleId.endsWith('8284'));
  check('8284 high-interest low-conv', !!lc, lc ? `try ${lc.tryOns}, book ${lc.bookings}` : 'NOT flagged');
  const withConv = (perf.styles ?? []).filter((s: { tryOns: number }) => s.tryOns >= 3);
  const top = withConv.reduce((b: { conversionRate: number } | null, s: { conversionRate: number }) => (!b || s.conversionRate > b.conversionRate ? s : b), null) as { styleId: string; conversionRate: number } | null;
  check('8265 top converter', !!top && top.styleId.endsWith('8265'), top ? `${top.styleId.slice(-4)} @ ${top.conversionRate}` : 'none');

  console.log('\n— Platform-hot (选品) —');
  const hot = getPlatformHotTags(styles.map((s) => ({ merchantId: s.merchantId, discoveryFacets: s.tags.map((t) => ({ label: t })) })), 5);
  console.log('  top tags:', hot.map((h) => `${h.tag}(${h.merchantCount}m/${h.styleCount}s)`).join(', ') || '—');

  console.log(`\n${pass ? '✅ PREFLIGHT PASS' : '❌ PREFLIGHT FAIL — fix before demo (re-run seed:intelligence / seed fillers)'}\n`);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error('preflight error (is `npm run dev` running?):', e instanceof Error ? e.message : e);
  process.exit(1);
});
