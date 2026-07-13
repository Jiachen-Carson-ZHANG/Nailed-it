// Seed the agent team (ADR-0007, Phase 1) into Supabase: the agent DEFINITIONS + a few demo
// historical runs/actions so the /merchant/agents panel renders before the Python service runs.
// Idempotent — upserts agents by slug, and replaces only seed runs (input.seed = true), preserving
// any real runs the Python service later writes.
//
//   npx tsx scripts/seed-agents.ts   (or: npm run seed:agents)
//
// Run AFTER migration 0022 is applied.

import { config } from 'dotenv';
config({ path: '.env.local' });

import WebSocketImpl from 'ws';
import { createClient } from '@supabase/supabase-js';
import { AGENT_DEFINITIONS, generateAgentRuns } from '../src/mock/agent-seed';
import { demoMerchantId } from '../src/mock/merchants';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
// @ts-expect-error - realtime ws shim under node (same as seed-intelligence.ts)
globalThis.WebSocket = WebSocketImpl;
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // 1) Upsert agent definitions by slug.
  const { error: upsertErr } = await db.from('agents').upsert(
    AGENT_DEFINITIONS.map((a) => ({
      slug: a.slug,
      name: a.name,
      role: a.role,
      instructions: a.instructions,
      tools: a.tools,
      version: a.version,
    })),
    { onConflict: 'slug' },
  );
  if (upsertErr) throw new Error(`upsert agents: ${upsertErr.message}`);

  const { data: agentRows, error: selErr } = await db.from('agents').select('id, slug');
  if (selErr) throw new Error(`select agents: ${selErr.message}`);
  const idBySlug = new Map((agentRows as { id: string; slug: string }[]).map((r) => [r.slug, r.id]));

  // 2) Replace prior seed runs (cascade deletes their actions).
  const { error: delErr } = await db
    .from('agent_runs')
    .delete()
    .eq('merchant_id', demoMerchantId)
    .eq('input->>seed', 'true');
  if (delErr) throw new Error(`delete seed runs: ${delErr.message}`);

  // 3) Insert runs in dependency order (parent before child), resolving parent + agent ids.
  const seedIdToUuid = new Map<string, string>();
  const runs = generateAgentRuns(Date.now());
  let runCount = 0;
  let actionCount = 0;

  for (const run of runs) {
    const agentId = idBySlug.get(run.agentSlug);
    if (!agentId) throw new Error(`no agent row for slug ${run.agentSlug} — is the agents table seeded?`);
    const parentUuid = run.parentRunId ? seedIdToUuid.get(run.parentRunId) ?? null : null;

    const { data: inserted, error: runErr } = await db
      .from('agent_runs')
      .insert({
        agent_id: agentId,
        merchant_id: run.merchantId,
        trigger_source: run.triggerSource,
        parent_run_id: parentUuid,
        status: run.status,
        input: { ...(run.input as Record<string, unknown>), seed: true },
        output: run.output,
        transcript: run.transcript,
        started_at: run.startedAt,
        finished_at: run.finishedAt,
      })
      .select('id')
      .single();
    if (runErr) throw new Error(`insert run (${run.agentSlug}): ${runErr.message}`);
    seedIdToUuid.set(run.id, (inserted as { id: string }).id);
    runCount += 1;

    for (const action of run.actions ?? []) {
      const { error: actErr } = await db.from('agent_actions').insert({
        run_id: (inserted as { id: string }).id,
        merchant_id: action.merchantId,
        type: action.type,
        risk: action.risk,
        status: action.status,
        payload: action.payload,
        created_at: action.createdAt,
      });
      if (actErr) throw new Error(`insert action (${action.type}): ${actErr.message}`);
      actionCount += 1;
    }
  }

  console.log(`Seeded ${AGENT_DEFINITIONS.length} agents, ${runCount} runs, ${actionCount} actions.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
