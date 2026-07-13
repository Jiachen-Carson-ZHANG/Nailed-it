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

  it('a monitor oversees its operator-lane siblings (even idle ones), not the planner that dispatched it', () => {
    const round = [
      run('decision', 'orch', '商分', { role: 'planner' }),
      run('ad', 'decision', '投广', { role: 'operator', actions: 1 }),
      run('coupon', 'decision', '团购', { role: 'operator', actions: 0 }), // dispatched, didn't place → still overseen
      run('reviewer', 'decision', '风控', { role: 'reviewer' }), // a reviewer sibling is not an audit target
      run('monitor', 'decision', 'Monitor', { role: 'reviewer' }),
    ];
    const d = deriveRunDetail('monitor', round)!;
    expect(d.auditTargets.map((t) => t.agentName).sort()).toEqual(['团购', '投广']);
    // a non-reviewer run has no audit targets
    expect(deriveRunDetail('ad', round)!.auditTargets).toEqual([]);
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
