import { MobileLayout } from '@/components/layout/MobileLayout';
import { getTrendingStyles } from '@/mock/styles';
import { StyleWaterfallGridClient } from '@/features/customer/StyleWaterfallGridClient';

export default function CustomerHomePage() {
  const styles = getTrendingStyles();

  return (
    <MobileLayout role="customer" title="Nailed-it">
      <section className="home-header" aria-labelledby="customer-home-title">
        <p className="section-eyebrow">For you</p>
        <h1 id="customer-home-title">Pick a look. Get a quote.</h1>
      </section>

      <StyleWaterfallGridClient styles={styles} />
    </MobileLayout>
  );
}
