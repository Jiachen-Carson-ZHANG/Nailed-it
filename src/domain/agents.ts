// Merchant Operations Agent Team domain types (ADR-0007).
// These mirror migration 0022. The Python agent service writes runs/actions to Supabase; the
// /merchant/agents panel reads them through the repository seam (ADR-0004).

export const agentSlugs = [
  'orchestrator',
  'insight',
  'decision',
  'ad',
  'coupon',
  'catalog',
  'customer_ops',
  'monitor',
] as const;
export type AgentSlug = (typeof agentSlugs)[number];

export type AgentRole = 'lead' | 'analyst' | 'planner' | 'operator' | 'reviewer';

/** An agent definition — agents are data (Multica pattern). `instructions` is the system prompt. */
export type Agent = {
  id: string;
  slug: AgentSlug;
  name: string;
  role: AgentRole;
  instructions: string;
  tools: string[];
  version: number;
};

export type TriggerSource = 'manual' | 'event' | 'schedule';
export type RunStatus = 'running' | 'completed' | 'failed' | 'awaiting_approval';

/** Concrete side-effect a run performed. Reversible actions get one-click undo. */
export const agentActionTypes = [
  'place_ad',
  'set_group_buy_coupon',
  'list_style',
  'delist_style',
  'draft_upload',
  'send_customer_message',
] as const;
export type AgentActionType = (typeof agentActionTypes)[number];

export type ActionRisk = 'reversible' | 'irreversible';
export type ActionStatus = 'applied' | 'undone' | 'proposed' | 'approved';

export type AgentAction = {
  id: string;
  runId: string;
  merchantId: string;
  type: AgentActionType;
  risk: ActionRisk;
  status: ActionStatus;
  payload: Record<string, unknown>;
  createdAt: string;
};

/** One step in a run's thinking chain (the diagram's reasoning ⇄ tool ⇄ action). */
export type TranscriptStep =
  | { kind: 'reasoning'; text: string }
  | { kind: 'tool_call'; tool: string; input: unknown; output: unknown }
  | { kind: 'action'; actionType: AgentActionType; status: ActionStatus; summary: string };

/** A run as the panel reads it — joined with its agent identity + its actions. */
export type AgentRunView = {
  id: string;
  agentSlug: AgentSlug;
  agentName: string;
  agentRole: AgentRole;
  merchantId: string;
  triggerSource: TriggerSource;
  parentRunId: string | null;
  status: RunStatus;
  input: unknown;
  output: unknown;
  transcript: TranscriptStep[];
  startedAt: string;
  finishedAt: string | null;
  actions: AgentAction[];
};

/** Insert shapes for seeding / the (future) write path. */
export type NewAgentRun = Omit<AgentRunView, 'agentName' | 'agentRole' | 'actions'> & {
  actions?: NewAgentAction[];
};
export type NewAgentAction = Omit<AgentAction, 'id'> & { id?: string };

export function isAgentSlug(value: string): value is AgentSlug {
  return (agentSlugs as readonly string[]).includes(value);
}
