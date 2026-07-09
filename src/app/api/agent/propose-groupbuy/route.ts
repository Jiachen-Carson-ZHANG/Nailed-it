import { NextResponse } from 'next/server';
import { isValidGroupbuyDeal } from '@/domain/groupbuy';
import { proposeGroupbuyDealAction } from '@/lib/actions/groupbuy-actions';

// The 团购 agent proposes a real reviewable DRAFT (ADR-0012 Phase 2). Body: { deal, sourceRunId }. Shape is
// guarded here, terms are validated in the action; a valid proposal is persisted with source_run_id and its
// id returned so the Python tool can write the agent_action forward link (entity_type='groupbuy_deal').
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_json'] }, { status: 400 });
  }
  const { deal, sourceRunId } = (body ?? {}) as { deal?: unknown; sourceRunId?: unknown };
  if (!isValidGroupbuyDeal(deal)) {
    return NextResponse.json({ ok: false, errors: ['malformed_deal'] }, { status: 400 });
  }
  const result = await proposeGroupbuyDealAction(deal, typeof sourceRunId === 'string' ? sourceRunId : null);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
