import { describe, expect, it } from 'vitest';
import { deriveRunDetail, groupRunsIntoRounds } from './agents';
import type { AgentRunView } from './agents';

// deriveRunDetail powers the 今日 home reasoning drill-down's 上下游 lineage (Phase 3): from the full run
// list, resolve one run + who triggered it (parent) + who it triggered (children).

function run(
  id: string,
  parentRunId: string | null,
  agentName = id,
  opts: { role?: AgentRunView['agentRole']; actions?: number } = {},
): AgentRunView {
  return {
    id, agentSlug: 'decision', agentName, agentRole: opts.role ?? 'planner', merchantId: 'm',
    triggerSource: 'manual', parentRunId, status: 'completed', input: null, output: null,
    transcript: [], startedAt: '2026-07-06T00:00:00Z', finishedAt: '2026-07-06T00:01:00Z',
    actions: Array.from({ length: opts.actions ?? 0 }, () => ({}) as AgentRunView['actions'][number]),
  };
}

describe('deriveRunDetail: monitor is not listed as a 下游 child', () => {
  // monitor is dispatch-parented to decision but oversees the executors — it must not appear in
  // decision's children (its relationship is 监测对象, shown from its own side).
  const withSlug = (r: AgentRunView, slug: string): AgentRunView => ({ ...r, agentSlug: slug as AgentRunView['agentSlug'] });
  const runs = [
    withSlug(run('decision', 'orch', '商分', { role: 'planner' }), 'decision'),
    withSlug(run('ad', 'decision', '投广', { role: 'operator' }), 'ad'),
    withSlug(run('monitor', 'decision', 'Monitor', { role: 'reviewer' }), 'monitor'),
  ];
  it('decision children exclude the monitor', () => {
    const kids = deriveRunDetail('decision', runs)!.children.map((c) => c.agentName);
    expect(kids).toContain('投广');
    expect(kids).not.toContain('Monitor');
  });
});

describe('deriveRunDetail (run lineage)', () => {
  const runs = [run('orch', null, '编排'), run('child-a', 'orch', '投广'), run('child-b', 'orch', '团购')];

  it('resolves parent + children for a middle run', () => {
    const d = deriveRunDetail('child-a', runs)!;
    expect(d.run.id).toBe('child-a');
    expect(d.parent?.id).toBe('orch');
    expect(d.parent?.agentName).toBe('编排');
    expect(d.children).toHaveLength(0);
  });

  it('lists all downstream runs a parent spawned, with no parent of its own', () => {
    const d = deriveRunDetail('orch', runs)!;
    expect(d.parent).toBeNull();
    expect(d.children.map((c) => c.id).sort()).toEqual(['child-a', 'child-b']);
  });

  it('returns null when the run id is not in the list', () => {
    expect(deriveRunDetail('missing', runs)).toBeNull();
  });

  it('null parent when parentRunId points at a run that is not present', () => {
    const orphan = [run('x', 'gone')];
    expect(deriveRunDetail('x', orphan)!.parent).toBeNull();
  });

  it('a monitor oversees the operator lanes IN ITS ROUND (by round, not exact parent), not the planner or 风控', () => {
    // Distinct slugs + close timestamps so grouping keeps them one round. Operators are parented to a
    // DIFFERENT run than the monitor — the point of the round-based (not exact-parent) audit.
    const at = (id: string, slug: string, role: AgentRunView['agentRole'], iso: string, parent: string | null): AgentRunView =>
      ({ ...run(id, parent, id, { role }), agentSlug: slug as AgentRunView['agentSlug'], startedAt: iso });
    const round = [
      at('decision', 'decision', 'planner', '2026-07-12T03:00:00Z', 'orch'),
      at('ad', 'ad', 'operator', '2026-07-12T03:02:00Z', 'decision'),
      at('coupon', 'coupon', 'operator', '2026-07-12T03:03:00Z', 'decision'),
      at('reviewer', 'reviewer', 'reviewer', '2026-07-12T03:04:00Z', 'decision'), // 风控 — NOT an audit target
      at('monitor', 'monitor', 'reviewer', '2026-07-12T03:05:00Z', 'reviewer'),   // monitor: different parent
    ];
    const d = deriveRunDetail('monitor', round)!;
    expect(d.auditTargets.map((t) => t.agentName).sort()).toEqual(['ad', 'coupon']);
    expect(deriveRunDetail('ad', round)!.auditTargets).toEqual([]); // operators have no audit targets
    expect(deriveRunDetail('reviewer', round)!.auditTargets).toEqual([]); // 风控 is not the monitor
  });
});

describe('deriveRunDetail nextRoundDecision (cross-round memory loop)', () => {
  // rounds newest-first by started_at; the monitor of an EARLIER round links to the LATER round's 决策.
  const mk = (id: string, slug: string, iso: string, role: AgentRunView['agentRole'] = 'operator'): AgentRunView => ({
    ...run(id, null), agentSlug: slug as AgentRunView['agentSlug'], agentRole: role, startedAt: iso,
  });
  const runs = [
    // later round (newer)
    mk('n-monitor', 'monitor', '2026-07-12T04:10:00Z', 'reviewer'),
    mk('n-decision', 'decision', '2026-07-12T04:02:00Z', 'planner'),
    mk('n-insight', 'insight', '2026-07-12T04:00:00Z', 'analyst'),
    // earlier round
    mk('p-monitor', 'monitor', '2026-07-12T03:10:00Z', 'reviewer'),
    mk('p-decision', 'decision', '2026-07-12T03:02:00Z', 'planner'),
    mk('p-insight', 'insight', '2026-07-12T03:00:00Z', 'analyst'),
  ];
  it("only the MONITOR links to the next round's 决策 (executors do not)", () => {
    expect(deriveRunDetail('p-monitor', runs, 2)!.nextRoundDecision?.id).toBe('n-decision');
    expect(deriveRunDetail('p-insight', runs, 2)!.nextRoundDecision).toBeNull(); // analyst — no cross-round
    expect(deriveRunDetail('p-decision', runs, 2)!.nextRoundDecision).toBeNull(); // planner — no cross-round
  });
  it('the newest round monitor has no next round', () => {
    expect(deriveRunDetail('n-monitor', runs, 2)!.nextRoundDecision).toBeNull();
  });
});

describe('deriveRunDetail reviewedBy (executor → round Monitor, inverse of 监测对象)', () => {
  const at = (id: string, slug: string, role: AgentRunView['agentRole'], iso: string, parent: string | null): AgentRunView =>
    ({ ...run(id, parent, id, { role }), agentSlug: slug as AgentRunView['agentSlug'], startedAt: iso });
  const round = [
    at('decision', 'decision', 'planner', '2026-07-12T03:00:00Z', 'orch'),
    at('ad', 'ad', 'operator', '2026-07-12T03:02:00Z', 'decision'),
    at('monitor', 'monitor', 'reviewer', '2026-07-12T03:05:00Z', 'decision'),
  ];
  it('an executor names the round monitor as its downstream', () => {
    const d = deriveRunDetail('ad', round)!;
    expect(d.reviewedBy?.id).toBe('monitor');
  });
  it('non-executors (planner, monitor itself) have no reviewedBy', () => {
    expect(deriveRunDetail('decision', round)!.reviewedBy).toBeNull();
    expect(deriveRunDetail('monitor', round)!.reviewedBy).toBeNull();
  });
  it('an executor in a round WITHOUT a monitor has no reviewedBy', () => {
    const noMonitor = [
      at('decision', 'decision', 'planner', '2026-07-12T03:00:00Z', 'orch'),
      at('ad', 'ad', 'operator', '2026-07-12T03:02:00Z', 'decision'),
    ];
    expect(deriveRunDetail('ad', noMonitor)!.reviewedBy).toBeNull();
  });
});

describe('deriveRunDetail round tag (which 经营轮次)', () => {
  // Two FULL rounds (>= fullRoundMinRuns) newest-first. Use minRuns=3 so small fixtures qualify.
  const mk = (id: string, slug: string, iso: string, role: AgentRunView['agentRole'] = 'operator', trigger: AgentRunView['triggerSource'] = 'manual'): AgentRunView => ({
    ...run(id, null), agentSlug: slug as AgentRunView['agentSlug'], agentRole: role, startedAt: iso, triggerSource: trigger,
  });
  const runs = [
    // later (newest) round — event-triggered
    mk('n-monitor', 'monitor', '2026-07-12T04:10:00Z', 'reviewer'),
    mk('n-ad', 'ad', '2026-07-12T04:05:00Z', 'operator'),
    mk('n-decision', 'decision', '2026-07-12T04:00:00Z', 'planner', 'event'),
    // earlier round — manual
    mk('p-monitor', 'monitor', '2026-07-12T03:10:00Z', 'reviewer'),
    mk('p-ad', 'ad', '2026-07-12T03:05:00Z', 'operator'),
    mk('p-decision', 'decision', '2026-07-12T03:00:00Z', 'planner', 'manual'),
  ];
  it('newest full round is the highest ordinal; total counts full rounds', () => {
    const d = deriveRunDetail('n-ad', runs, 3)!;
    expect(d.round).toEqual({ ordinal: 2, total: 2, triggerSource: 'event', startedAt: '2026-07-12T04:00:00Z' });
  });
  it('earlier round is ordinal 1, trigger from its opener', () => {
    const d = deriveRunDetail('p-ad', runs, 3)!;
    expect(d.round?.ordinal).toBe(1);
    expect(d.round?.triggerSource).toBe('manual');
  });
  it('a partial round (below the min) has no round tag', () => {
    const stray = [mk('s1', 'ad', '2026-07-12T05:00:00Z', 'operator')];
    expect(deriveRunDetail('s1', stray, 3)!.round).toBeNull();
  });
});

describe('groupRunsIntoRounds (runtime record grouped by round)', () => {
  const at = (id: string, slug: string, iso: string): AgentRunView => ({
    ...run(id, null), agentSlug: slug as AgentRunView['agentSlug'], startedAt: iso,
  });
  it('cuts a round when a slug repeats (one dispatch per agent per round)', () => {
    const runs = [
      at('r5', 'monitor', '2026-07-12T03:40:00Z'),
      at('r4', 'ad', '2026-07-12T03:39:00Z'),
      at('r3', 'decision', '2026-07-12T03:38:00Z'),
      at('r2', 'ad', '2026-07-12T03:20:00Z'), // repeat slug vs r4 → previous round
      at('r1', 'decision', '2026-07-12T03:19:00Z'),
    ];
    const rounds = groupRunsIntoRounds(runs);
    expect(rounds.map((r) => r.map((x) => x.id))).toEqual([['r5', 'r4', 'r3'], ['r2', 'r1']]);
  });
  it('cuts a round on a >30min gap even without a repeated slug', () => {
    const runs = [
      at('b2', 'ad', '2026-07-12T06:00:00Z'),
      at('b1', 'decision', '2026-07-12T04:00:00Z'),
    ];
    expect(groupRunsIntoRounds(runs).length).toBe(2);
  });
});
