import { NextResponse } from 'next/server';
import { proposeGroupbuyForStyleAction } from '@/lib/actions/groupbuy-actions';

// The 团购 agent proposes a real reviewable DRAFT (ADR-0012 Phase 2).
// Body: { styleId, dealPriceCents, sourceRunId }. TS builds the deal from the published style (title,
// original price, its authoritative catalog services) and validates the terms; the returned deal id becomes
// the agent_action's entity_id (entity_type='groupbuy_deal'). The merchant edits/publishes it in 团购管理.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_json'] }, { status: 400 });
  }
  const { styleId, dealPriceCents, sourceRunId } = (body ?? {}) as Record<string, unknown>;
  if (typeof styleId !== 'string' || typeof dealPriceCents !== 'number' || !Number.isFinite(dealPriceCents) || dealPriceCents <= 0) {
    return NextResponse.json({ ok: false, errors: ['malformed_input'] }, { status: 400 });
  }
  const result = await proposeGroupbuyForStyleAction({
    styleId,
    dealPriceCents: Math.round(dealPriceCents),
    sourceRunId: typeof sourceRunId === 'string' ? sourceRunId : null,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
