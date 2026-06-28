import { NextResponse } from 'next/server';
import { listCustomerPublishedStylesAction } from '@/lib/actions/merchant-style-actions';

// Published styles across ALL merchants, for the 选品 agent's catalog matching + platform-hot
// (ADR-0007). Grounded supply data from the TS read model — the agent fetches it, matches external
// trends against it, but never invents catalog facts.
export async function GET() {
  const styles = await listCustomerPublishedStylesAction();
  return NextResponse.json({
    styles: styles.map((s) => ({
      id: s.id,
      title: s.title,
      merchantId: s.merchantId,
      tags: s.discoveryFacets.map((f) => f.label),
    })),
  });
}
