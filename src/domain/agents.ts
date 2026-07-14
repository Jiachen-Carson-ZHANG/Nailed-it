// Merchant Operations Agent Team domain types (ADR-0007).
// These mirror migration 0022. The Python agent service writes runs/actions to Supabase; the
// /merchant/agents panel reads them through the repository seam (ADR-0004).

export const agentSlugs = [
  'orchestrator',
  'insight',
  'trend',
  'decision',
  'ad',
  'coupon',
  'catalog',
  'customer_ops',
  'reviewer',
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
  'update_ad_campaign',
  'pause_ad_campaign',
  'set_group_buy_coupon',
  'list_style',
  'delist_style',
  'feature_style',
  'deprioritize_style',
  'draft_upload',
  'send_customer_message',
  'draft_customer_message',
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
  /** The real commercial object this action produced (ADR-0012 Phase 2). Null on pre-contract rows and
   *  actions that create no entity (e.g. a message). `entityType` mirrors migration 0027's check. */
  entityType?: 'style_ad' | 'groupbuy_deal' | null;
  entityId?: string | null;
};

/** Can this action be undone/rejected? An `applied` action only if it is reversible (a sent message is
 *  not); a `proposed` one always (rejecting a proposal costs nothing). The single source of truth for the
 *  guard the repositories enforce — callers pre-check with it before touching the real entity. */
export function canUndoAction(action: Pick<AgentAction, 'status' | 'risk'>): boolean {
  if (action.status === 'proposed') return true;
  return action.status === 'applied' && action.risk === 'reversible';
}

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

// ── run lineage (the 今日 home reasoning drill-down, Phase 3) ─────────────────────

/** A lightweight reference to a related run — what the lineage chips render (no transcript). */
export type RunRef = { id: string; agentName: string; agentSlug: AgentSlug; status: RunStatus };

/** A run with its upstream (who spawned it) + downstream (who it spawned) — the drill-down's lineage.
 *  `auditTargets` is set only for a reviewer (monitor): the executor lanes it actually measures. */
export type AgentRunDetail = {
  run: AgentRunView;
  parent: RunRef | null;
  children: RunRef[];
  auditTargets: RunRef[];
  /** The NEXT round's 决策 (商分) run — where this round's monitor findings land via memory (ADR-0015).
   *  The cross-round loop's payoff: "what the team decided next, informed by what this round measured".
   *  Null on the newest round. */
  nextRoundDecision: RunRef | null;
};

function toRunRef(r: AgentRunView): RunRef {
  return { id: r.id, agentName: r.agentName, agentSlug: r.agentSlug, status: r.status };
}

const ROUND_GAP_MS = 30 * 60 * 1000;

/** Newest-first ROUNDS, reconstructed from the runs list by the dispatcher's own rule: RoundState runs
 *  each agent AT MOST ONCE per round, so a repeated slug marks the previous round's start; a >30min gap
 *  is the secondary cut (rounds complete in minutes — gap-only grouping chained rehearsal rounds). */
export function groupRunsIntoRounds(runs: AgentRunView[]): AgentRunView[][] {
  const rounds: AgentRunView[][] = [];
  let current: AgentRunView[] = [];
  let seen = new Set<string>();
  for (const run of runs) {
    const prev = current[current.length - 1];
    const gap = prev ? new Date(prev.startedAt).getTime() - new Date(run.startedAt).getTime() : 0;
    if (current.length > 0 && (seen.has(run.agentSlug) || gap > ROUND_GAP_MS)) {
      rounds.push(current);
      current = [];
      seen = new Set();
    }
    current.push(run);
    seen.add(run.agentSlug);
  }
  if (current.length > 0) rounds.push(current);
  return rounds;
}

/** Pure: from the full run list, resolve one run + its parent + its children. Deterministic → testable.
 *  The I/O shell (getAgentRunDetailAction) just supplies `allRuns`. */
export function deriveRunDetail(runId: string, allRuns: AgentRunView[]): AgentRunDetail | null {
  const run = allRuns.find((r) => r.id === runId);
  if (!run) return null;
  const parent = run.parentRunId ? allRuns.find((r) => r.id === run.parentRunId) ?? null : null;
  const children = allRuns.filter((r) => r.parentRunId === runId);
  // A monitor is dispatched by the planner but OVERSEES the executors — its true subjects are the
  // operator-role lanes in the same round (its same-parent siblings), not the planner that dispatched
  // it. Shown on the run page as "监测对象" instead of a misleading "由商分触发" parent line. Included even
  // when a lane didn't act this round: "did 投广 act? no" is itself part of what the monitor reviews.
  const auditTargets =
    run.agentRole === 'reviewer'
      ? allRuns
          .filter((r) => r.id !== runId && r.parentRunId !== null && r.parentRunId === run.parentRunId && r.agentRole === 'operator')
          .map(toRunRef)
      : [];

  // Cross-round link: rounds newest-first, so the round BEFORE this one in the array is the LATER round.
  // Target its 决策 run — the monitor's memory from this round is injected there next round. Sort
  // defensively so the derivation doesn't depend on the caller's ordering.
  const ordered = [...allRuns].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const rounds = groupRunsIntoRounds(ordered);
  const idx = rounds.findIndex((rd) => rd.some((r) => r.id === runId));
  let nextRoundDecision: RunRef | null = null;
  for (let j = idx - 1; idx > 0 && j >= 0; j -= 1) {
    const decision = rounds[j].find((r) => r.agentSlug === 'decision') ?? rounds[j].find((r) => r.agentRole === 'planner');
    if (decision) { nextRoundDecision = toRunRef(decision); break; }
  }

  return { run, parent: parent ? toRunRef(parent) : null, children: children.map(toRunRef), auditTargets, nextRoundDecision };
}
