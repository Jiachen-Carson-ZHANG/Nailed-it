// Seed a BACKDATED round of agent history (ADR-0015 demo design): campaigns with 7 days of
// accumulated metrics + their agent_actions rows carrying the decision brain's hypothesis snapshots.
// The point: memory is NEVER seeded directly — the live monitor measures these real rows on stage and
// writes agent_memory itself (record_action_outcome computes measured-vs-predicted in code). A judge
// asking "where did this memory come from?" gets a queryable answer: this campaign, this action.
//
//   npm run seed:agent-history      (idempotent — replaces its own prior rows, input.seedHistory=true)
//
// Run AFTER migrations 0022/0027/0028 (campaigns + entity contract). The optional merchant_preference
// row additionally needs 0030+0032 — skipped with a warning when absent.
//
// The two seeded campaigns are chosen to sit on either side of the monitor's bright lines:
//   8284 (over-spender): budget ¥200/day > ¥100 line, spend/booking = 56000/2 = ¥280 > ¥200 line,
//        hypothesis said ¥80/booking → measured 3.5× worse → outcome memory + a live revision.
//   8265 (healthy):      spend/booking = 15000/9 ≈ ¥17 vs predicted ¥18 → 符合预测 → memory only,
//        revising it would be the trigger-happy failure the eval forbids.

import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';
import { demoMerchantId } from '../src/mock/merchants';
import { LOW_CONVERSION_ID, TOP_CONVERTER_ID } from '../src/mock/intelligence-seed';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
// @ts-expect-error - realtime ws shim under node (same as seed-agents.ts)
globalThis.WebSocket = WebSocketImpl;
const db = createClient(url, key, { auth: { persistSession: false } });

const DAY = 86_400_000;
const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

const OVERSPENDER = {
  styleId: LOW_CONVERSION_ID, // 8284 金属感
  campaignId: `ad-${LOW_CONVERSION_ID}`,
  budgetCents: 20_000,
  metrics: { impressions: 4_000, clicks: 120, bookings: 2, spend_cents: 56_000 },
  hypothesis: { expectedRoas: 4.1, exposureRatio: 0.61, costPerBookingCents: 8_000, capacityBand: 'idle' },
};
const HEALTHY = {
  styleId: TOP_CONVERTER_ID, // 8265 法式碎钻
  campaignId: `ad-${TOP_CONVERTER_ID}`,
  budgetCents: 5_000,
  metrics: { impressions: 3_000, clicks: 150, bookings: 9, spend_cents: 15_000 },
  hypothesis: { expectedRoas: 4.0, exposureRatio: 0.72, costPerBookingCents: 1_800, capacityBand: 'idle' },
};

async function main() {
  const { data: agentRows, error: agentErr } = await db.from('agents').select('id, slug');
  if (agentErr) throw new Error(`select agents: ${agentErr.message}`);
  const idBySlug = new Map((agentRows as { id: string; slug: string }[]).map((r) => [r.slug, r.id]));
  for (const slug of ['decision', 'ad']) {
    if (!idBySlug.has(slug)) throw new Error(`no agent row for ${slug} — run npm run seed:agents first`);
  }

  // idempotent: replace prior history runs (agent_actions cascade with their runs)
  const { error: delErr } = await db
    .from('agent_runs')
    .delete()
    .eq('merchant_id', demoMerchantId)
    .eq('input->>seedHistory', 'true');
  if (delErr) throw new Error(`delete prior history: ${delErr.message}`);

  // 1) the backdated decision run (7 days ago) — the lineage root for both executor runs
  const { data: decisionRun, error: decErr } = await db
    .from('agent_runs')
    .insert({
      agent_id: idBySlug.get('decision'),
      merchant_id: demoMerchantId,
      trigger_source: 'event',
      status: 'completed',
      input: { seedHistory: true, rangeDays: 7 },
      output: {
        text:
          '上周决策：8284 金属感高需求但零成单——按估算 ROAS 4.1、每单成本 80 元投顶部漏斗 ¥200/天；' +
          '8265 转化最好且曝光不足——投 ¥50/天。',
      },
      transcript: [
        { kind: 'reasoning', text: '决策大脑：8284 expectedRoas 4.1、每单成本估算 80 元；8265 expectedRoas 4.0、每单成本估算 18 元。产能 idle，两款均可接住。' },
      ],
      started_at: iso(7 * DAY + 60_000),
      finished_at: iso(7 * DAY + 30_000),
    })
    .select('id')
    .single();
  if (decErr) throw new Error(`insert decision run: ${decErr.message}`);
  const decisionRunId = (decisionRun as { id: string }).id;

  // 2) executor runs + campaigns + hypothesis-bearing actions
  const seeded: Record<string, string> = {};
  for (const c of [OVERSPENDER, HEALTHY]) {
    const { data: adRun, error: runErr } = await db
      .from('agent_runs')
      .insert({
        agent_id: idBySlug.get('ad'),
        merchant_id: demoMerchantId,
        trigger_source: 'event',
        parent_run_id: decisionRunId,
        status: 'completed',
        input: { seedHistory: true, styleId: c.styleId },
        output: { text: `已按决策投放 ${c.styleId}（¥${c.budgetCents / 100}/天）。` },
        transcript: [
          { kind: 'tool_call', tool: 'place_ad', input: { styleId: c.styleId, slot: 'top_funnel', budgetCents: c.budgetCents }, output: { entityId: c.campaignId, campaignStatus: 'active' } },
          { kind: 'action', actionType: 'place_ad', status: 'applied', summary: `投广：${c.styleId} · top_funnel · 日预算 ${c.budgetCents / 100}` },
        ],
        started_at: iso(7 * DAY),
        finished_at: iso(7 * DAY - 30_000),
      })
      .select('id')
      .single();
    if (runErr) throw new Error(`insert ad run (${c.styleId}): ${runErr.message}`);
    const adRunId = (adRun as { id: string }).id;

    // the campaign with a week of accumulated data (merchant launched the draft last week)
    const { error: campErr } = await db.from('style_ad_campaign').upsert(
      {
        id: c.campaignId,
        merchant_id: demoMerchantId,
        merchant_style_id: c.styleId,
        status: 'active',
        daily_budget_cents: c.budgetCents,
        source_run_id: adRunId,
        ...c.metrics,
        notes: 'seed-history: 上周投放，已积累 7 天实测数据',
        created_at: iso(7 * DAY),
        updated_at: iso(0),
      },
      { onConflict: 'id' },
    );
    if (campErr) throw new Error(`upsert campaign (${c.campaignId}): ${campErr.message}`);

    // the action row the monitor will anchor memory to — hypothesis snapshot included, exactly as
    // place_ad writes it live (ADR-0015)
    const { data: actionRow, error: actErr } = await db
      .from('agent_actions')
      .insert({
        run_id: adRunId,
        merchant_id: demoMerchantId,
        type: 'place_ad',
        risk: 'reversible',
        status: 'applied',
        payload: { styleId: c.styleId, slot: 'top_funnel', budgetCents: c.budgetCents, hypothesis: c.hypothesis },
        entity_type: 'style_ad',
        entity_id: c.campaignId,
        created_at: iso(7 * DAY - 20_000),
      })
      .select('id')
      .single();
    if (actErr) throw new Error(`insert action (${c.styleId}): ${actErr.message}`);
    seeded[c.styleId] = (actionRow as { id: string }).id;
  }

  // 3) merchant preference — the one legitimately seedable memory kind (it represents merchant
  //    settings, not agent experience). Needs 0030+0032; skipped loudly when absent.
  const { error: prefErr } = await db.from('agent_memory').upsert(
    {
      merchant_id: demoMerchantId,
      agent_slug: 'merchant_ui',
      kind: 'merchant_preference',
      key: 'pref-groupbuy-floor',
      domain: 'merchant',
      scope_type: 'merchant',
      scope_id: demoMerchantId,
      claim: '商家偏好：团购券后价不得低于原价的 60%；30 天内到过店的客户不发召回消息。',
      content: { verdict: '商家偏好：团购券后价不得低于原价的 60%；30 天内到过店的客户不发召回消息。' },
      confidence: 'high',
      expires_at: null,
    },
    { onConflict: 'merchant_id,kind,key' },
  );
  const prefNote = prefErr
    ? `merchant_preference SKIPPED (apply 0030+0032): ${prefErr.message}`
    : 'merchant_preference seeded';

  console.log(
    [
      'Seeded backdated history (7 days ago):',
      `  over-spender ${OVERSPENDER.styleId}: ¥200/day, 120 clicks, 2 bookings, ¥560 spent — action ${seeded[OVERSPENDER.styleId]}`,
      `  healthy      ${HEALTHY.styleId}: ¥50/day, 150 clicks, 9 bookings, ¥150 spent — action ${seeded[HEALTHY.styleId]}`,
      `  ${prefNote}`,
      'Demo: round 1 → monitor measures these live (memory + one revision); round 2 → 决策 cites the memory.',
    ].join('\n'),
  );
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
