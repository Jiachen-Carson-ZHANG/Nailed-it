'use server';

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import { agentActionTypes, canUndoAction, deriveRunDetail, type Agent, type AgentAction, type AgentActionType, type AgentRunDetail, type AgentRunView } from '@/domain/agents';
import { groupbuyWithdrawTarget } from '@/domain/action-entity-contract';
import { withdrawStyleAdCampaignAction } from '@/lib/actions/style-ad-actions';
import { usesSupabaseBackend, getServiceClient } from '@/lib/db/client';

/** One team-memory row for the panel (ADR-0015): the agent's claim + code-anchored evidence. */
export type TeamMemoryView = {
  id: string;
  kind: string; // action_outcome | calibration | round_verdict | merchant_preference
  claim: string;
  confidence: string | null;
  scopeId: string | null; // style/entity/merchant the conclusion is about
  comparison: { ratio?: number; direction?: string } | null;
  createdAt: string;
  expiresAt: string | null;
  agentSlug: string | null; // 来源 agent (monitor writes them; merchant_ui for preferences)
  sourceActionId: string | null; // the action row this conclusion is anchored to (evidence)
  entityId: string | null; // the campaign/deal the conclusion is about
};

/** The team's live memory (non-expired, newest first) — powers the 团队记忆 card on /merchant/agents.
 *  Written ONLY by the monitor from measured outcomes (plus explicit merchant preferences); reading it
 *  here is what makes "the team learns" inspectable instead of claimed. Memory-mode: empty (no table). */
export async function listTeamMemoryAction(limit = 12, kinds?: string[]): Promise<TeamMemoryView[]> {
  if (!usesSupabaseBackend()) return [];
  let q = getServiceClient()
    .from('agent_memory')
    .select('id, kind, claim, content, confidence, scope_id, comparison, created_at, expires_at, agent_slug, source_action_id, entity_id')
    .eq('merchant_id', demoMerchantId)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  // 晨报 asks for measured kinds only — filtering server-side keeps the newest OUTCOMES visible even
  // when a burst of round_verdict rows would otherwise crowd them out of the newest-N window.
  if (kinds && kinds.length > 0) q = q.in('kind', kinds);
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return []; // pre-0030/0032 DB — the card simply doesn't render
  return (data ?? []).map((r) => ({
    id: r.id as string,
    kind: String(r.kind),
    claim: String(r.claim ?? (r.content as { verdict?: string } | null)?.verdict ?? ''),
    confidence: (r.confidence as string | null) ?? null,
    scopeId: (r.scope_id as string | null) ?? null,
    comparison: (r.comparison as { ratio?: number; direction?: string } | null) ?? null,
    createdAt: String(r.created_at),
    expiresAt: (r.expires_at as string | null) ?? null,
    agentSlug: (r.agent_slug as string | null) ?? null,
    sourceActionId: (r.source_action_id as string | null) ?? null,
    entityId: (r.entity_id as string | null) ?? null,
  })).filter((m) => m.claim);
}

/** The agent team definitions for the panel. */
export async function listAgentsAction(): Promise<Agent[]> {
  return getRepositories().agents.listAgents();
}

/** One brief's contribution to the week's objective, plus what it has actually delivered so far. */
export type WeeklyObjectiveItem = {
  actionType: string; // ad | coupon
  styleId: string;
  styleTitle: string;
  targetMin: number;
  targetMax: number;
  measuredBookings: number; // from the real campaign/deal row
  status: string; // draft | active | paused | ended | pending — the entity's live state
};

/** The week's objective as a DERIVED view (never stored — it can't diverge from the entities it sums).
 *  Goal = Σ the latest round's action briefs (target booking ranges); progress = Σ measured bookings on
 *  the real style_ad_campaign rows for those briefed styles. Returns null in memory-mode / pre-migration
 *  / when no round has filed briefs yet — the card then shows the "no plan yet" state. */
export async function getWeeklyObjectiveAction(): Promise<{
  targetMin: number;
  targetMax: number;
  measuredBookings: number;
  items: WeeklyObjectiveItem[];
} | null> {
  if (!usesSupabaseBackend()) return null;
  const db = getServiceClient();
  const round = await db
    .from('agent_rounds')
    .select('blackboard, started_at')
    .eq('merchant_id', demoMerchantId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (round.error) return null;
  const briefs = ((round.data?.blackboard as { briefs?: unknown[] } | null)?.briefs ?? []) as Array<{
    action_type?: string;
    style_id?: string;
    target_bookings_min?: number | null;
    target_bookings_max?: number | null;
  }>;
  if (briefs.length === 0) return null;

  const titles = await getStyleTitleMapAction();
  const camps = await db
    .from('style_ad_campaign')
    .select('merchant_style_id, bookings, status')
    .eq('merchant_id', demoMerchantId);
  const bookingsByStyle = new Map<string, { bookings: number; status: string }>();
  for (const c of camps.data ?? []) {
    bookingsByStyle.set(String(c.merchant_style_id), {
      bookings: Number(c.bookings ?? 0),
      status: String(c.status ?? 'draft'),
    });
  }

  const items: WeeklyObjectiveItem[] = briefs.map((b) => {
    const styleId = String(b.style_id ?? '');
    const camp = bookingsByStyle.get(styleId);
    return {
      actionType: String(b.action_type ?? ''),
      styleId,
      styleTitle: titles[styleId] ?? styleId,
      targetMin: Number(b.target_bookings_min ?? 0),
      targetMax: Number(b.target_bookings_max ?? 0),
      measuredBookings: camp?.bookings ?? 0,
      status: camp?.status ?? 'pending', // coupon deals + un-placed briefs have no campaign row yet
    };
  });

  return {
    targetMin: items.reduce((s, i) => s + i.targetMin, 0),
    targetMax: items.reduce((s, i) => s + i.targetMax, 0),
    measuredBookings: items.reduce((s, i) => s + i.measuredBookings, 0),
    items,
  };
}

/** styleId → title for the demo merchant. Transcript/action surfaces render real style names
 *  ("Melissa Design 8284"), not machine ids — the describers take this as their `titles` map. */
export async function getStyleTitleMapAction(): Promise<Record<string, string>> {
  const rows = await getRepositories().merchantStyles.listByMerchant(demoMerchantId);
  return Object.fromEntries(rows.map((r) => [r.id, r.title]));
}

/** Recent runs for the demo merchant (most recent first) — powers /merchant/agents. */
export async function listAgentRunsAction(): Promise<AgentRunView[]> {
  return getRepositories().agents.listRuns(demoMerchantId);
}

export async function getAgentRunAction(id: string): Promise<AgentRunView | null> {
  return getRepositories().agents.getRun(id);
}

/** A run + its upstream/downstream lineage — powers the 今日 home reasoning drill-down (Phase 3). One
 *  read (listRuns returns full views) fed to the pure `deriveRunDetail`; lineage stays deterministic. */
export async function getAgentRunDetailAction(runId: string): Promise<AgentRunDetail | null> {
  const runs = await getRepositories().agents.listRuns(demoMerchantId);
  return deriveRunDetail(runId, runs);
}

/**
 * Move the real commercial object this action produced to a not-live state (ADR-0012 Phase 2).
 * Actions with no entity (a sent message, a pre-contract row) are a no-op.
 *
 * ORDER: the entity is withdrawn BEFORE agent_actions.status is mirrored. If the mirror then fails, the
 * campaign is already paused / the deal already unlisted — the merchant's money is safe and the stale pill
 * self-corrects, because the entity's own status is authoritative. The reverse order would report "undone"
 * while the ad kept spending.
 */
async function withdrawEntity(action: AgentAction): Promise<void> {
  if (!action.entityType || !action.entityId) return;

  if (action.entityType === 'style_ad') {
    await withdrawStyleAdCampaignAction(action.entityId);
    return;
  }

  const deal = await getRepositories().groupbuy.getByIdForMerchant(action.entityId, demoMerchantId);
  if (!deal) return;
  const target = groupbuyWithdrawTarget(deal.status);
  if (target === null) return; // already not live
  await getRepositories().groupbuy.setStatus(action.entityId, demoMerchantId, target);
}

/** Undo/reject: stop the real entity, then mirror the coarse status. Returns null if the action may not be
 *  undone (an applied irreversible action, e.g. a message already sent) — the entity is never touched. */
async function withdrawAgentAction(actionId: string): Promise<AgentAction | null> {
  const action = await getRepositories().agents.getAction(actionId, demoMerchantId);
  if (!action || !canUndoAction(action)) return null;
  await withdrawEntity(action);
  return getRepositories().agents.setActionStatus(actionId, demoMerchantId, 'undone');
}

/** One-click undo for a reversible action (ADR-0007): pauses the campaign / unlists the deal it created. */
export async function undoAgentActionAction(actionId: string): Promise<AgentAction | null> {
  return withdrawAgentAction(actionId);
}

/** Approve a gated `proposed` action — the one human gate (ADR-0007 §4): 上架-a-new-style. Flips
 *  status → 'approved'. (Actually publishing the new style still needs the merchant's image; the
 *  publish wiring lands when the style domain settles — this records the approval intent.) */
export async function approveAgentActionAction(actionId: string): Promise<AgentAction | null> {
  return getRepositories().agents.setActionStatus(actionId, demoMerchantId, 'approved');
}

/** Reject a gated `proposed` action — shelves the draft entity it produced, then flips status → 'undone'. */
export async function rejectAgentActionAction(actionId: string): Promise<AgentAction | null> {
  return withdrawAgentAction(actionId);
}

/** Applied actions of given types for the demo merchant — powers the in-context surfaces (投广 /
 *  价格config / 老板msg) that show what the agents did on the real pages. */
export async function listAgentActionsAction(types: AgentActionType[]): Promise<AgentAction[]> {
  const allowedTypes = new Set<string>(agentActionTypes);
  const safeTypes = types.filter((type): type is AgentActionType => allowedTypes.has(type));
  if (safeTypes.length === 0) return [];
  return getRepositories().agents.listActions(demoMerchantId, { types: safeTypes, statuses: ['applied'] });
}

/**
 * Trigger one agent round from the panel (ADR-0007 §10 trigger). Spawns the Python service detached
 * (`agent-service/.venv/bin/python -m nailed_agents`); it writes runs/actions to Supabase as it goes,
 * so the panel can poll and show running→completed live. Localhost-demo only — the deployed app has
 * no Python runtime, so this is disabled in production. Each round calls the model (spends credits).
 */
export async function triggerAgentRoundAction(): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Agent round can only be triggered from a local dev run.' };
  }
  const serviceDir = path.join(process.cwd(), 'agent-service');
  const python = path.join(serviceDir, '.venv', 'bin', 'python');
  if (!existsSync(python)) {
    return { ok: false, error: 'agent-service/.venv not found — run `pip install -e .` in agent-service first.' };
  }
  try {
    const child = spawn(python, ['-m', 'nailed_agents'], {
      cwd: serviceDir,
      detached: true,
      stdio: 'ignore',
    });
    child.unref(); // don't block the request on the ~1–2 min round; the panel polls Supabase
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'failed to start the agent service' };
  }
}
