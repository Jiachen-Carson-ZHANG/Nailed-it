'use server';

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import { agentActionTypes, deriveRunDetail, type Agent, type AgentAction, type AgentActionType, type AgentRunDetail, type AgentRunView } from '@/domain/agents';

/** The agent team definitions for the panel. */
export async function listAgentsAction(): Promise<Agent[]> {
  return getRepositories().agents.listAgents();
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

/** One-click undo for a reversible action (ADR-0007). Flips status → 'undone'. */
export async function undoAgentActionAction(actionId: string): Promise<AgentAction | null> {
  return getRepositories().agents.setActionStatus(actionId, demoMerchantId, 'undone');
}

/** Approve a gated `proposed` action — the one human gate (ADR-0007 §4): 上架-a-new-style. Flips
 *  status → 'approved'. (Actually publishing the new style still needs the merchant's image; the
 *  publish wiring lands when the style domain settles — this records the approval intent.) */
export async function approveAgentActionAction(actionId: string): Promise<AgentAction | null> {
  return getRepositories().agents.setActionStatus(actionId, demoMerchantId, 'approved');
}

/** Reject a gated `proposed` action — flips status → 'undone' so it won't be acted on. */
export async function rejectAgentActionAction(actionId: string): Promise<AgentAction | null> {
  return getRepositories().agents.setActionStatus(actionId, demoMerchantId, 'undone');
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
