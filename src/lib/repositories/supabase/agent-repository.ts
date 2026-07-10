import { getServiceClient } from '@/lib/db/client';
import type {
  Agent,
  AgentAction,
  AgentRunView,
  ActionStatus,
  TranscriptStep,
  AgentSlug,
  AgentRole,
  AgentActionType,
  ActionRisk,
  TriggerSource,
  RunStatus,
} from '@/domain/agents';
import type { AgentRepository } from '../types';

interface AgentRow {
  id: string;
  slug: string;
  name: string;
  role: string;
  instructions: string;
  tools: string[] | null;
  version: number;
}

interface ActionRow {
  id: string;
  run_id: string;
  merchant_id: string;
  type: string;
  risk: string;
  status: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  entity_type: string | null;
  entity_id: string | null;
}

interface RunRow {
  id: string;
  agent_id: string;
  merchant_id: string;
  trigger_source: string;
  parent_run_id: string | null;
  status: string;
  input: unknown;
  output: unknown;
  transcript: TranscriptStep[] | null;
  started_at: string;
  finished_at: string | null;
  agent: { slug: string; name: string; role: string } | { slug: string; name: string; role: string }[] | null;
  actions: ActionRow[] | null;
}

function rowToAgent(r: AgentRow): Agent {
  return {
    id: r.id,
    slug: r.slug as AgentSlug,
    name: r.name,
    role: r.role as AgentRole,
    instructions: r.instructions,
    tools: r.tools ?? [],
    version: r.version,
  };
}

function rowToAction(r: ActionRow): AgentAction {
  return {
    id: r.id,
    runId: r.run_id,
    merchantId: r.merchant_id,
    type: r.type as AgentActionType,
    risk: r.risk as ActionRisk,
    status: r.status as ActionStatus,
    payload: r.payload ?? {},
    createdAt: r.created_at,
    entityType: (r.entity_type as AgentAction['entityType']) ?? null,
    entityId: r.entity_id ?? null,
  };
}

function rowToRunView(r: RunRow): AgentRunView {
  const agent = Array.isArray(r.agent) ? r.agent[0] : r.agent;
  return {
    id: r.id,
    agentSlug: (agent?.slug ?? 'orchestrator') as AgentSlug,
    agentName: agent?.name ?? agent?.slug ?? '',
    agentRole: (agent?.role ?? 'operator') as AgentRole,
    merchantId: r.merchant_id,
    triggerSource: r.trigger_source as TriggerSource,
    parentRunId: r.parent_run_id,
    status: r.status as RunStatus,
    input: r.input ?? {},
    output: r.output ?? null,
    transcript: (r.transcript ?? []) as TranscriptStep[],
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    actions: (r.actions ?? []).map(rowToAction),
  };
}

const RUN_SELECT = '*, agent:agents(slug,name,role), actions:agent_actions(*)';

export function createSupabaseAgentRepository(): AgentRepository {
  return {
    async listAgents(): Promise<Agent[]> {
      const { data, error } = await getServiceClient().from('agents').select('*').order('slug');
      if (error) throw new Error(`AgentRepository.listAgents failed: ${error.message}`);
      return (data as AgentRow[]).map(rowToAgent);
    },

    async listRuns(merchantId: string): Promise<AgentRunView[]> {
      const { data, error } = await getServiceClient()
        .from('agent_runs')
        .select(RUN_SELECT)
        .eq('merchant_id', merchantId)
        .order('started_at', { ascending: false });
      if (error) throw new Error(`AgentRepository.listRuns failed: ${error.message}`);
      return (data as RunRow[]).map(rowToRunView);
    },

    async getRun(id: string): Promise<AgentRunView | null> {
      const { data, error } = await getServiceClient()
        .from('agent_runs')
        .select(RUN_SELECT)
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(`AgentRepository.getRun failed: ${error.message}`);
      return data ? rowToRunView(data as RunRow) : null;
    },

    async getAction(actionId: string, merchantId: string): Promise<AgentAction | null> {
      const { data, error } = await getServiceClient()
        .from('agent_actions')
        .select('*')
        .eq('id', actionId)
        .eq('merchant_id', merchantId)
        .maybeSingle();
      if (error) throw new Error(`AgentRepository.getAction failed: ${error.message}`);
      return data ? rowToAction(data as ActionRow) : null;
    },

    async setActionStatus(
      actionId: string,
      merchantId: string,
      status: ActionStatus,
    ): Promise<AgentAction | null> {
      if (status !== 'approved' && status !== 'undone') return null;

      let query = getServiceClient()
        .from('agent_actions')
        .update({ status })
        .eq('id', actionId)
        .eq('merchant_id', merchantId);

      if (status === 'approved') {
        query = query.eq('status', 'proposed').eq('type', 'draft_upload');
      } else {
        query = query.in('status', ['applied', 'proposed']).or('risk.eq.reversible,status.eq.proposed');
      }

      const { data, error } = await query.select('*').maybeSingle();
      if (error) throw new Error(`AgentRepository.setActionStatus failed: ${error.message}`);
      return data ? rowToAction(data as ActionRow) : null;
    },

    async listActions(
      merchantId: string,
      opts?: { types?: AgentActionType[]; statuses?: ActionStatus[] },
    ): Promise<AgentAction[]> {
      let q = getServiceClient()
        .from('agent_actions')
        .select('*')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false });
      if (opts?.types) q = q.in('type', opts.types);
      if (opts?.statuses) q = q.in('status', opts.statuses);
      const { data, error } = await q;
      if (error) throw new Error(`AgentRepository.listActions failed: ${error.message}`);
      return (data as ActionRow[]).map(rowToAction);
    },
  };
}
