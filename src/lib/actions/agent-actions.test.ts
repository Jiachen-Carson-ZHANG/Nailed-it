import { beforeEach, describe, expect, it } from 'vitest';
import { resetRepositoriesForTests, getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import type { AgentAction } from '@/domain/agents';
import { listAgentRunsAction, undoAgentActionAction } from './agent-actions';

// Entity-aware undo (ADR-0012 Phase 2). Undo used to flip agent_actions.status and stop there, so the deal
// stayed published and the campaign kept spending. These run against the memory bundle end-to-end.

async function allActions(): Promise<AgentAction[]> {
  const runs = await listAgentRunsAction();
  return runs.flatMap((r) => r.actions);
}

describe('undoAgentActionAction', () => {
  beforeEach(() => resetRepositoriesForTests());

  it('unlists the real group-buy deal, not just the action log row', async () => {
    const coupon = (await allActions()).find((a) => a.entityType === 'groupbuy_deal')!;
    expect(coupon.status).toBe('applied');

    const before = await getRepositories().groupbuy.getByIdForMerchant(coupon.entityId!, demoMerchantId);
    expect(before?.status).toBe('published');

    const undone = await undoAgentActionAction(coupon.id);

    expect(undone?.status).toBe('undone');
    const after = await getRepositories().groupbuy.getByIdForMerchant(coupon.entityId!, demoMerchantId);
    expect(after?.status).toBe('unlisted'); // the entity is authoritative — money/offer actually stopped
  });

  it('refuses an applied irreversible action and never touches its entity', async () => {
    const message = (await allActions()).find((a) => a.risk === 'irreversible' && a.status === 'applied')!;
    expect(await undoAgentActionAction(message.id)).toBeNull();

    const still = (await allActions()).find((a) => a.id === message.id);
    expect(still?.status).toBe('applied'); // a sent message cannot be unsent
  });

  it('is idempotent: undoing twice leaves the entity unlisted and does not throw', async () => {
    const coupon = (await allActions()).find((a) => a.entityType === 'groupbuy_deal')!;
    await undoAgentActionAction(coupon.id);

    // Second call: the action is already 'undone', so the guard stops it before the entity is touched.
    expect(await undoAgentActionAction(coupon.id)).toBeNull();
    const after = await getRepositories().groupbuy.getByIdForMerchant(coupon.entityId!, demoMerchantId);
    expect(after?.status).toBe('unlisted');
  });

  it('undoes a pre-contract action that has no entity (nothing to withdraw)', async () => {
    const ad = (await allActions()).find((a) => a.type === 'place_ad')!;
    expect(ad.entityType ?? null).toBeNull();
    expect((await undoAgentActionAction(ad.id))?.status).toBe('undone');
  });
});
