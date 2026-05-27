import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getTrendingStyles } from '@/mock/styles';
import { StyleWaterfallGridClient } from '@/features/customer/StyleWaterfallGridClient';
import { getCustomerBookingPath } from '@/domain/session';

export default function CustomerHomePage() {
  const styles = getTrendingStyles();

  return (
    <MobileLayout role="customer" title="Nailed-it">
      <section className="home-header" aria-labelledby="customer-home-title">
        <div className="home-header-text">
          <p className="section-eyebrow">For you</p>
          <h1 id="customer-home-title">Pick a look. Get a quote.</h1>
        </div>
        <Link
          className="button button-primary button-compact"
          href={getCustomerBookingPath()}
        >
          ＋ My photo
        </Link>
      </section>

      <StyleWaterfallGridClient styles={styles} />
    </MobileLayout>
  );
}
