import { NextResponse } from 'next/server';
import { getStyleBusinessDecisionsAction } from '@/lib/actions/decision-actions';

// The 决策 agent's grounded decision input (ADR-0012 Phase 2): per-style {ad|coupon|display_only|skip}
// + scores + signals + shared next-week capacity, computed by the deterministic brain. The agent
// SYNTHESISES across this + the briefing + trends + monitor; it does not re-derive the numbers.
export async function GET() {
  const result = await getStyleBusinessDecisionsAction();
  return NextResponse.json(result);
}
