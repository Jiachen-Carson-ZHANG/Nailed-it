import { MobileLayout } from '@/components/layout/MobileLayout';
import { MerchantBookingDetailClient } from './booking-detail-client';

type MerchantBookingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MerchantBookingDetailPage({
  params
}: MerchantBookingDetailPageProps) {
  const { id } = await params;

  return (
    <MobileLayout
      brandHref="/merchant/calendar"
      role="merchant"
      showTabs={false}
      subtitle="Review the shared booking snapshot that customers and merchant tools both derive from."
      title="Nailed-it"
    >
      <MerchantBookingDetailClient id={id} />
    </MobileLayout>
  );
}
