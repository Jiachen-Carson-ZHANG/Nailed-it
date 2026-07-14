import { MobileLayout } from '@/components/layout/MobileLayout';
import { HandMatchClient } from '@/features/customer/HandMatchClient';

export default function HandMatchPage() {
  return (
    <MobileLayout role="customer" title="Nailed-it" mainClassName="mobile-content-hand-match">
      <HandMatchClient />
    </MobileLayout>
  );
}
