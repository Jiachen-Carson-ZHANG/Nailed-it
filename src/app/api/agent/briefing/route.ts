import { NextResponse, type NextRequest } from 'next/server';
import { getMerchantInsightsAction } from '@/lib/actions/insights-actions';
import { demoMerchantId } from '@/mock/merchants';

// Grounded briefing for the agent team's 数分 (Insight) agent. Reuses the ADR-0006 intelligence
// layer so the Python agent service never re-derives metrics (ADR-0007 guardrail: agents act on
// pre-computed numbers, never invent them). Phase 1: single demo merchant.
export async function GET(req: NextRequest) {
  const rangeDays = req.nextUrl.searchParams.get('rangeDays') === '1' ? 1 : 7;
  const insights = await getMerchantInsightsAction(rangeDays);
  return NextResponse.json({ merchantId: demoMerchantId, rangeDays, insights });
}
