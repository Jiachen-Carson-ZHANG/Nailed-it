import { notFound } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import type { QuoteLine } from '@/lib/services/quote-service';
import { homePathForRole } from '@/domain/session';
import { StyleDetailPanel } from '@/features/customer/StyleDetailPanel';
import { quoteCatalogSelectionsAction } from '@/lib/actions/booking-actions';
import { getCustomerPublishedStyleAction } from '@/lib/actions/merchant-style-actions';

type StyleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StyleDetailPage({ params }: StyleDetailPageProps) {
  const { id } = await params;
  const style = await getCustomerPublishedStyleAction(id);

  if (!style) {
    notFound();
  }

  // Reference per-line price/duration for the 款式构成 breakdown, derived the same way as the
  // preview total (quoteService). Best-effort: if pricing can't resolve, fall back to composition.
  let quoteLines: QuoteLine[] = [];
  try {
    quoteLines = (await quoteCatalogSelectionsAction(style.catalogBreakdown)).lines;
  } catch {
    quoteLines = [];
  }

  return (
    <MobileLayout
      brandHref={homePathForRole('customer')}
      role="customer"
      title="Nailed-it"
    >
      <StyleDetailPanel style={style} />
    </MobileLayout>
  );
}
