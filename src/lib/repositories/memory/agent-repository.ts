import type {
  Agent,
  AgentAction,
  AgentRunView,
  ActionStatus,
  NewAgentRun,
} from '@/domain/agents';
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

    async setActionStatus(actionId: string, status: ActionStatus): Promise<AgentAction | null> {
      const action = actions.find((a) => a.id === actionId);
      if (!action) return null;
      action.status = status;
      return structuredClone(action);
    },
  };
}
