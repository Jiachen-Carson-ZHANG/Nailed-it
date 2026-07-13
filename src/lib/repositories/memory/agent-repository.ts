import type {
  Agent,
  AgentAction,
  AgentActionType,
  AgentRunView,
  ActionStatus,
  NewAgentRun,
} from '@/domain/agents';
import { canUndoAction } from '@/domain/agents';
import { AGENT_DEFINITIONS, generateAgentRuns } from '@/mock/agent-seed';
import type { AgentRepository } from '../types';

/** In-memory agent substrate mirroring the Supabase variant. Seeds the definitions + a few demo
 *  runs so the panel renders; tests pass a deterministic `runsSeed`. */
export function createMemoryAgentRepository(
  agents: Agent[] = AGENT_DEFINITIONS,
  runsSeed: NewAgentRun[] = generateAgentRuns(Date.now()),
): AgentRepository {
  const agentBySlug = new Map(agents.map((a) => [a.slug, a]));
  const runs: Omit<NewAgentRun, 'actions'>[] = [];
  const actions: AgentAction[] = [];
  let seq = 0;

  for (const seed of structuredClone(runsSeed)) {
    const { actions: acts, ...run } = seed;
    runs.push(run);
    for (const a of acts ?? []) {
      seq += 1;
      actions.push({ ...a, id: a.id ?? `act-mem-${seq}` });
    }
  }

  function toView(run: Omit<NewAgentRun, 'actions'>): AgentRunView {
    const def = agentBySlug.get(run.agentSlug);
    return {
      ...run,
      agentName: def?.name ?? run.agentSlug,
      agentRole: def?.role ?? 'operator',
      actions: actions.filter((a) => a.runId === run.id),
    };
  }

  function canTransition(action: AgentAction, status: ActionStatus): boolean {
    if (status === 'approved') {
      return action.status === 'proposed' && action.type === 'draft_upload';
    }
    if (status === 'undone') return canUndoAction(action);
    return false;
  }

  return {
    async listAgents(): Promise<Agent[]> {
      return structuredClone(agents);
    },

    async listRuns(merchantId: string): Promise<AgentRunView[]> {
      return structuredClone(
        runs
          .filter((r) => r.merchantId === merchantId)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .map(toView),
      );
    },

    async getRun(id: string): Promise<AgentRunView | null> {
      const run = runs.find((r) => r.id === id);
      return run ? structuredClone(toView(run)) : null;
    },

    async getAction(actionId: string, merchantId: string): Promise<AgentAction | null> {
      const action = actions.find((a) => a.id === actionId && a.merchantId === merchantId);
      return action ? structuredClone(action) : null;
    },

    async setActionStatus(
      actionId: string,
      merchantId: string,
      status: ActionStatus,
    ): Promise<AgentAction | null> {
      const action = actions.find((a) => a.id === actionId && a.merchantId === merchantId);
      if (!action || !canTransition(action, status)) return null;
      action.status = status;
      return structuredClone(action);
    },

    async listActions(
      merchantId: string,
      opts?: { types?: AgentActionType[]; statuses?: ActionStatus[] },
    ): Promise<AgentAction[]> {
      return structuredClone(
        actions
          .filter((a) => a.merchantId === merchantId)
          .filter((a) => !opts?.types || opts.types.includes(a.type))
          .filter((a) => !opts?.statuses || opts.statuses.includes(a.status))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    },
  };
}
