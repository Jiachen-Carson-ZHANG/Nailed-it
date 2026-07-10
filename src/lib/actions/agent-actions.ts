'use server';

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import { agentActionTypes, canUndoAction, deriveRunDetail, type Agent, type AgentAction, type AgentActionType, type AgentRunDetail, type AgentRunView } from '@/domain/agents';
import { groupbuyWithdrawTarget } from '@/domain/action-entity-contract';
import { withdrawStyleAdCampaignAction } from '@/lib/actions/style-ad-actions';

/** The agent team definitions for the panel. */
export async function listAgentsAction(): Promise<Agent[]> {
  return getRepositories().agents.listAgents();
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
