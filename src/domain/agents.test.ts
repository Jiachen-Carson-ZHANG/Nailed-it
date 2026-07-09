import { describe, expect, it } from 'vitest';
import { deriveRunDetail } from './agents';
import type { AgentRunView } from './agents';

// deriveRunDetail powers the 今日 home reasoning drill-down's 上下游 lineage (Phase 3): from the full run
// list, resolve one run + who triggered it (parent) + who it triggered (children).

function run(id: string, parentRunId: string | null, agentName = id): AgentRunView {
  return {
    id, agentSlug: 'decision', agentName, agentRole: 'planner', merchantId: 'm',
    triggerSource: 'manual', parentRunId, status: 'completed', input: null, output: null,
    transcript: [], startedAt: '2026-07-06T00:00:00Z', finishedAt: '2026-07-06T00:01:00Z', actions: [],
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
});
