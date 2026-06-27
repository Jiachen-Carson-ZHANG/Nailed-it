'use server';

import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import type { Agent, AgentAction, AgentRunView } from '@/domain/agents';

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

/** One-click undo for a reversible action (ADR-0007). Flips status → 'undone'. */
export async function undoAgentActionAction(actionId: string): Promise<AgentAction | null> {
  return getRepositories().agents.setActionStatus(actionId, 'undone');
}

/** Approve a gated `proposed` action — the one human gate (ADR-0007 §4): 上架-a-new-style. Flips
 *  status → 'approved'. (Actually publishing the new style still needs the merchant's image; the
 *  publish wiring lands when the style domain settles — this records the approval intent.) */
export async function approveAgentActionAction(actionId: string): Promise<AgentAction | null> {
  return getRepositories().agents.setActionStatus(actionId, 'approved');
}

/** Reject a gated `proposed` action — flips status → 'undone' so it won't be acted on. */
export async function rejectAgentActionAction(actionId: string): Promise<AgentAction | null> {
  return getRepositories().agents.setActionStatus(actionId, 'undone');
}
