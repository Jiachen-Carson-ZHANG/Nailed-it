import { describe, expect, it } from 'vitest';
import { createMemoryAgentRepository } from './agent-repository';
import { AGENT_DEFINITIONS, generateAgentRuns } from '@/mock/agent-seed';
import { demoMerchantId } from '@/mock/merchants';

const NOW = Date.parse('2026-06-27T00:00:00Z');
const mk = () => createMemoryAgentRepository(AGENT_DEFINITIONS, generateAgentRuns(NOW));

describe('memory AgentRepository', () => {
  it('lists the agent team definitions', async () => {
    const agents = await mk().listAgents();
    expect(agents).toHaveLength(AGENT_DEFINITIONS.length);
    expect(agents.map((a) => a.slug)).toEqual(
      expect.arrayContaining(['insight', 'decision', 'ad', 'coupon', 'monitor']),
    );
  });

  it('lists runs most-recent first, joined with agent identity + actions', async () => {
    const runs = await mk().listRuns(demoMerchantId);
    expect(runs.length).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < runs.length; i += 1) {
      expect(runs[i - 1].startedAt >= runs[i].startedAt).toBe(true);
    }
    const ad = runs.find((r) => r.agentSlug === 'ad');
    expect(ad?.agentName).toBe('投广 Agent');
    expect(ad?.agentRole).toBe('operator');
    expect(ad?.actions).toHaveLength(1);
    expect(ad?.actions[0]?.type).toBe('place_ad');
  });

  it('getRun returns the transcript with an action step', async () => {
    const repo = mk();
    const runs = await repo.listRuns(demoMerchantId);
    const adId = runs.find((r) => r.agentSlug === 'ad')!.id;
    const run = await repo.getRun(adId);
    expect(run?.transcript.some((s) => s.kind === 'action')).toBe(true);
    expect(run?.transcript.some((s) => s.kind === 'tool_call')).toBe(true);
  });

  it('setActionStatus undoes a reversible action (panel one-click undo)', async () => {
    const repo = mk();
    const runs = await repo.listRuns(demoMerchantId);
    const action = runs.flatMap((r) => r.actions)[0];
    expect(action.status).toBe('applied');

    const updated = await repo.setActionStatus(action.id, 'undone');
    expect(updated?.status).toBe('undone');

    const after = await repo.getRun(action.runId);
    expect(after?.actions.find((a) => a.id === action.id)?.status).toBe('undone');
  });

  it('surfaces the gated 上架 proposal and approves it (the one human gate, ADR-0007 §4)', async () => {
    const repo = mk();
    const runs = await repo.listRuns(demoMerchantId);

    const catalog = runs.find((r) => r.agentSlug === 'catalog');
    expect(catalog?.status).toBe('awaiting_approval');
    const proposal = catalog?.actions.find((a) => a.type === 'draft_upload');
    expect(proposal?.status).toBe('proposed');
    expect(proposal?.risk).toBe('irreversible');

    const approved = await repo.setActionStatus(proposal!.id, 'approved');
    expect(approved?.status).toBe('approved');
    const after = await repo.getRun(catalog!.id);
    expect(after?.actions.find((a) => a.id === proposal!.id)?.status).toBe('approved');
  });

  it('customer-ops run carries a reversible boss-message action', async () => {
    const runs = await mk().listRuns(demoMerchantId);
    const co = runs.find((r) => r.agentSlug === 'customer_ops');
    expect(co?.actions[0]?.type).toBe('send_customer_message');
    expect(co?.actions[0]?.risk).toBe('reversible');
  });

  it('returns null for an unknown run', async () => {
    expect(await mk().getRun('nope')).toBeNull();
  });
});
