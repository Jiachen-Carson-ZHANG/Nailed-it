import { NextResponse } from 'next/server';
import { getStyleBusinessDecisionsAction } from '@/lib/actions/decision-actions';

// The 决策 agent's grounded decision input (ADR-0016: facts + signals, never a verdict): per-style
// scores + signal tags + ad/coupon economics + shared next-week capacity, computed by the
// deterministic engine. The agent SYNTHESISES across this + the briefing + trends + memory; it does
// not re-derive the numbers.
export async function GET() {
  const result = await getStyleBusinessDecisionsAction();
  return NextResponse.json(result);
}
