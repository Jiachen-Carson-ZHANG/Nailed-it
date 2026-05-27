import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getTrendingStyles } from '@/mock/styles';
import { StyleWaterfallGridClient } from '@/features/customer/StyleWaterfallGridClient';
import { getCustomerBookingPath } from '@/domain/session';

export default function CustomerHomePage() {
  const styles = getTrendingStyles();

  return (
    <MobileLayout role="customer" title="Nailed-it">
      <section className="discovery-hero" aria-labelledby="customer-home-title">
        <p className="section-eyebrow">For you</p>
        <h1 id="customer-home-title">Pick a look. Get a quote.</h1>
        <Link className="button button-primary button-block" href={getCustomerBookingPath()}>
          Book from my own photo →
        </Link>
      </section>

      <StyleWaterfallGridClient styles={styles} />
    </MobileLayout>
  );
}
