'use server';

import { getRepositories } from '@/lib/repositories';
import { demoMerchantId } from '@/mock/merchants';
import {
  createDefaultGroupbuyDraft,
  toGroupbuyRecord,
  type GroupbuyDeal,
  type GroupbuyDealRecord,
} from '@/domain/groupbuy';
import { validateGroupbuyDeal } from '@/domain/groupbuy-validation';

// ADR-0012 Phase 2. The agent proposes a real, reviewable group-buy DRAFT (not an applied log row): terms
// are validated by the shared parser, then persisted through the repo seam with source_run_id so the deal
// is traceable to the run. The Python tool calls this, then writes the agent_action with entity_id = the
// returned deal id (the forward link). The merchant reviews/publishes the draft in 团购管理.
const MERCHANT_CURRENCY = 'CNY'; // demo; per-merchant currency from the merchants repo later

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

// ── Merchant-facing 团购管理 (ADR-0012 Phase 2) ─────────────────────────────────────────────────
// The panel used to read browser localStorage, so DB-created deals (including everything the agent
// proposed) were invisible. These actions put it on the repository seam. Deals carrying a sourceRunId are
// agent proposals awaiting the merchant's review.

export async function listGroupbuyDealsAction(): Promise<GroupbuyDealRecord[]> {
  return getRepositories().groupbuy.listByMerchant(demoMerchantId);
}

export async function getGroupbuyDealAction(id: string): Promise<GroupbuyDealRecord | null> {
  return getRepositories().groupbuy.getByIdForMerchant(id, demoMerchantId);
}

/** Save an edited/new deal as a draft. Terms are validated at draft level (lenient). */
export async function saveGroupbuyDraftAction(deal: GroupbuyDeal): Promise<ProposeGroupbuyResult> {
  const check = validateGroupbuyDeal(deal, false);
  if (!check.ok) return { ok: false, errors: check.errors };
  const existing = await getRepositories().groupbuy.getByIdForMerchant(deal.id, demoMerchantId);
  const record = toGroupbuyRecord(
    { ...deal, status: 'draft', updatedAt: new Date().toISOString() },
    demoMerchantId,
    existing?.currency ?? MERCHANT_CURRENCY,
    existing?.sourceRunId ?? null, // preserve the run that proposed it
  );
  return { ok: true, deal: await getRepositories().groupbuy.save(record) };
}

/** Publish a deal: stricter validation (title + at least one service), then the draft→published transition. */
export async function publishGroupbuyDealAction(deal: GroupbuyDeal): Promise<ProposeGroupbuyResult> {
  const check = validateGroupbuyDeal(deal, true);
  if (!check.ok) return { ok: false, errors: check.errors };
  const saved = await saveGroupbuyDraftAction(deal);
  if (!saved.ok) return saved;
  const published = await getRepositories().groupbuy.setStatus(deal.id, demoMerchantId, 'published');
  if (!published) return { ok: false, errors: ['illegal_transition_to_published'] };
  return { ok: true, deal: published };
}

/** Withdraw a live deal (published→unlisted) or bring one back (unlisted→published). */
export async function setGroupbuyStatusAction(
  id: string,
  status: 'published' | 'unlisted',
): Promise<ProposeGroupbuyResult> {
  const updated = await getRepositories().groupbuy.setStatus(id, demoMerchantId, status);
  if (!updated) return { ok: false, errors: ['illegal_transition'] };
  return { ok: true, deal: updated };
}

/** Duplicate a deal as a fresh, merchant-authored draft (no sourceRunId — it is no longer the agent's). */
export async function copyGroupbuyDealAction(deal: GroupbuyDeal): Promise<ProposeGroupbuyResult> {
  const now = new Date().toISOString();
  const copy: GroupbuyDeal = {
    ...deal,
    id: `gb-copy-${Date.now()}`,
    title: `${deal.title} 副本`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
  const record = toGroupbuyRecord(copy, demoMerchantId, MERCHANT_CURRENCY, null);
  return { ok: true, deal: await getRepositories().groupbuy.save(record) };
}

/** The 团购 agent's entry point: it names a published style + a post-coupon price. We build a REAL, editable
 *  draft from that style — its title, its current price as the original, and its authoritative catalog
 *  breakdown as the bundled services — so the merchant sees a publishable deal in 团购管理, not a log row. */
export async function proposeGroupbuyForStyleAction(input: {
  styleId: string;
  dealPriceCents: number;
  sourceRunId: string | null;
}): Promise<ProposeGroupbuyResult> {
  const style = await getRepositories().merchantStyles.getByIdForMerchant(input.styleId, demoMerchantId);
  if (!style || style.status !== 'published') return { ok: false, errors: ['style_not_published'] };
  if (style.previewPriceCents == null) return { ok: false, errors: ['style_has_no_price'] };

  const deal: GroupbuyDeal = {
    ...createDefaultGroupbuyDraft(),
    id: `gb-${input.styleId}`, // stable → re-proposing the same style updates its draft
    title: `${style.title} 团购`,
    originalPrice: style.previewPriceCents / 100,
    dealPrice: input.dealPriceCents / 100,
    serviceSelections: style.catalogBreakdown.map((s) => ({
      catalogItemId: s.catalogItemId,
      enabled: true,
      quantity: s.quantity,
    })),
  };
  return proposeGroupbuyDealAction(deal, input.sourceRunId);
}
