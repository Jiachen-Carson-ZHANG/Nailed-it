import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getTrendingStyles } from '@/mock/styles';
import { StyleWaterfallGridClient } from '@/features/customer/StyleWaterfallGridClient';
import { getCustomerBookingPath } from '@/domain/session';

export default function CustomerHomePage() {
  const styles = getTrendingStyles();

  return (
    <MobileLayout role="customer" title="Nailed-it">
      <div className="xhs-home-header">
        <p className="xhs-home-tagline">Find your next nail look</p>
        <Link className="xhs-upload-pill" href={getCustomerBookingPath()}>
          + Upload your photo
        </Link>
      </div>
      <StyleWaterfallGridClient styles={styles} />
    </MobileLayout>
  );
}
