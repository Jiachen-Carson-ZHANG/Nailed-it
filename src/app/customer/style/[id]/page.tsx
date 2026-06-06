import { notFound } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { homePathForRole } from '@/domain/session';
import { StyleDetailPanel } from '@/features/customer/StyleDetailPanel';
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
