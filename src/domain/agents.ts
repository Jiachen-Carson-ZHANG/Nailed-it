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
  /** For an EXECUTOR (投广/团购/…): the round's Monitor that measures this action — the executor's real
   *  downstream (监测), the inverse of the monitor's 监测对象. Null for non-executors. */
  reviewedBy: RunRef | null;
  /** The NEXT round's 决策 (商分) run — where this round's monitor findings land via memory (ADR-0015).
   *  The cross-round loop's payoff: "what the team decided next, informed by what this round measured".
   *  Null on the newest round. */
  nextRoundDecision: RunRef | null;
  /** Which 经营轮次 this run belongs to (ordinal among full rounds, newest = highest) + how the round
   *  was triggered + when — so a thinking chain says which round it's in. Null for stray/partial runs. */
  round: { ordinal: number; total: number; triggerSource: TriggerSource; startedAt: string } | null;
};

function toRunRef(r: AgentRunView): RunRef {
  return { id: r.id, agentName: r.agentName, agentSlug: r.agentSlug, status: r.status };
}

const ROUND_GAP_MS = 30 * 60 * 1000;

/** A "full" round runs the whole pipeline (~10–11 lanes). Anything smaller is a partial/rehearsal or a
 *  stray anchor run — the UI (run audit, 最近轮次) hides them, and the cross-round 回流下一轮 link skips
 *  them, so it always lands on a real next round. Single source shared by the domain + those pages. */
export const FULL_ROUND_MIN_RUNS = 8;

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
export function deriveRunDetail(runId: string, allRuns: AgentRunView[], fullRoundMinRuns: number = FULL_ROUND_MIN_RUNS): AgentRunDetail | null {
  const run = allRuns.find((r) => r.id === runId);
  if (!run) return null;
  const parent = run.parentRunId ? allRuns.find((r) => r.id === run.parentRunId) ?? null : null;
  // The monitor is dispatch-parented to 商分 (it runs after the round is planned) but it OVERSEES the
  // round's executors — its subjects are its 监测对象, not a downstream ACTION of 商分. Exclude it from
  // every run's 下游 so 商分→下游 doesn't misleadingly list Monitor. (Its OWN children — the executors it
  // re-dispatches on a revision — are unaffected: those are parented to the monitor run, not filtered.)
  const children = allRuns.filter((r) => r.parentRunId === runId && r.agentSlug !== 'monitor');

  // 监测对象 + 回流下一轮 are both scoped by ROUND, so group once. Round membership (not exact
  // parentRunId) is the right key: within a round, executors and the monitor are dispatched under
  // different parent runs, so an exact-parent match dropped the monitor's real subjects (measured live).
  const ordered = [...allRuns].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  const rounds = groupRunsIntoRounds(ordered);
  const idx = rounds.findIndex((rd) => rd.some((r) => r.id === runId));
  const myRound = idx >= 0 ? rounds[idx] : [];

  // 监测对象: ONLY the monitor (slug), and it audits the EXECUTORS in its round — not 风控 (which reviews
  // 商分's briefs, a different relationship). Shown instead of the misleading "由商分触发" parent line.
  const auditTargets =
    run.agentSlug === 'monitor'
      ? myRound.filter((r) => r.id !== runId && r.agentRole === 'operator').map(toRunRef)
      : [];

  // 回流下一轮 — ONLY the monitor: it MEASURES the round, writes 实测结论 to memory, and an 偏差 can trip
  // the next round's alarm, so it is the one agent whose output causally feeds the NEXT round's 决策
  // (商分). Executors stay within their round (no cross-round link). rounds are newest-first, so the
  // round BEFORE this one in the array is the LATER (next) round.
  let nextRoundDecision: RunRef | null = null;
  if (run.agentSlug === 'monitor') {
    for (let j = idx - 1; idx > 0 && j >= 0; j -= 1) {
      if (rounds[j].length < fullRoundMinRuns) continue; // skip partial/rehearsal rounds — link to a REAL next round
      const decision = rounds[j].find((r) => r.agentSlug === 'decision') ?? rounds[j].find((r) => r.agentRole === 'planner');
      if (decision) { nextRoundDecision = toRunRef(decision); break; }
    }
  }

  // 下游监测: an executor's downstream is the round's Monitor (the inverse of 监测对象). Symmetric graph:
  // 商分 ↓ 投广 ↓ Monitor ↺ 商分(next round).
  const monitorRun = myRound.find((r) => r.agentSlug === 'monitor');
  const reviewedBy = run.agentRole === 'operator' && monitorRun ? toRunRef(monitorRun) : null;

  // Which 经营轮次: ordinal among FULL rounds (newest = highest), + how it was triggered + when.
  let round: AgentRunDetail['round'] = null;
  const fullRounds = rounds.filter((rd) => rd.length >= fullRoundMinRuns);
  const fullIdx = fullRounds.findIndex((rd) => rd.some((r) => r.id === runId));
  if (fullIdx >= 0) {
    const rd = fullRounds[fullIdx];
    const opener = rd.find((r) => r.agentRole === 'lead')
      ?? [...rd].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))[0];
    round = {
      ordinal: fullRounds.length - fullIdx,
      total: fullRounds.length,
      triggerSource: opener?.triggerSource ?? 'manual',
      startedAt: opener?.startedAt ?? rd[0].startedAt,
    };
  }

  return { run, parent: parent ? toRunRef(parent) : null, children: children.map(toRunRef), auditTargets, reviewedBy, nextRoundDecision, round };
}
