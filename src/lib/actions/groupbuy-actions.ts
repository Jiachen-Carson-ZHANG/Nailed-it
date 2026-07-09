'use server';

import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import { toGroupbuyRecord, type GroupbuyDeal, type GroupbuyDealRecord } from '@/domain/groupbuy';
import { validateGroupbuyDeal } from '@/domain/groupbuy-validation';

// ADR-0012 Phase 2. The agent proposes a real, reviewable group-buy DRAFT (not an applied log row): terms
// are validated by the shared parser, then persisted through the repo seam with source_run_id so the deal
// is traceable to the run. The Python tool calls this, then writes the agent_action with entity_id = the
// returned deal id (the forward link). The merchant reviews/publishes the draft in 团购管理.
const MERCHANT_CURRENCY = 'SGD'; // demo; per-merchant currency from the merchants repo later

export type ProposeGroupbuyResult =
  | { ok: true; deal: GroupbuyDealRecord }
  | { ok: false; errors: string[] };

export async function proposeGroupbuyDealAction(deal: GroupbuyDeal, sourceRunId: string | null): Promise<ProposeGroupbuyResult> {
  // Draft-level validation — the merchant tightens to publishable in the panel. Reject nonsense early.
  const check = validateGroupbuyDeal(deal, false);
  if (!check.ok) return { ok: false, errors: check.errors };

  const record = toGroupbuyRecord({ ...deal, status: 'draft' }, demoMerchantId, MERCHANT_CURRENCY, sourceRunId);
  const saved = await getRepositories().groupbuy.save(record);
  return { ok: true, deal: saved };
}
