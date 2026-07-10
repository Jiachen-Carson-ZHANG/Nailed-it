import { NextResponse } from 'next/server';
import { proposeStyleAdAction } from '@/lib/actions/style-ad-actions';

// The 投广 agent proposes a real StyleAd campaign (ADR-0012 Phase 2).
// Body: { styleId, dailyBudgetCents, sourceRunId }. Inside the merchant's per-campaign cap it auto-launches
// (status 'active' — withdrawable daily-drip spend); above it, it stays a 'draft' the merchant launches from
// 投广中心. The returned id becomes the agent_action's entity_id (entity_type='style_ad').
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errors: ['invalid_json'] }, { status: 400 });
  }
  const { styleId, dailyBudgetCents, sourceRunId } = (body ?? {}) as Record<string, unknown>;
  if (typeof styleId !== 'string' || typeof dailyBudgetCents !== 'number' || !Number.isFinite(dailyBudgetCents) || dailyBudgetCents <= 0) {
    return NextResponse.json({ ok: false, errors: ['malformed_input'] }, { status: 400 });
  }
  try {
    const result = await proposeStyleAdAction({
      styleId,
      dailyBudgetCents: Math.round(dailyBudgetCents),
      sourceRunId: typeof sourceRunId === 'string' ? sourceRunId : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, errors: [e instanceof Error ? e.message : 'propose_ad_failed'] }, { status: 422 });
  }
}
