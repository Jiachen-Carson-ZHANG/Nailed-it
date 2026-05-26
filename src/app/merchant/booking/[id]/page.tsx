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
      title="Nailed-it"
    >
      <MerchantBookingDetailClient id={id} />
    </MobileLayout>
  );
}
