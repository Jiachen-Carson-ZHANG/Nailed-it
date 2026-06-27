import { MobileLayout } from '@/components/layout/MobileLayout';
import { CustomerHomeClient } from '@/features/customer/CustomerHomeClient';

export default function CustomerHomePage() {
  return (
    <MobileLayout role="customer" title="Nailed-it">
      <CustomerHomeClient />
    </MobileLayout>
  );
}
