import { MobileLayout } from '@/components/layout/MobileLayout';
import { getTrendingStyles } from '@/mock/styles';
import { StyleWaterfallGrid } from '@/features/customer/StyleWaterfallGrid';

export default function CustomerHomePage() {
  const styles = getTrendingStyles();
  const prices = styles.map((style) => style.previewQuote.price);
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);

  return (
    <MobileLayout
      role="customer"
      subtitle="Discovery feed built from the shared mock style source of truth."
      title="Nailed-it"
    >
      <section className="discovery-hero" aria-labelledby="customer-home-title">
        <div>
          <p className="section-eyebrow">Customer home</p>
          <h1 id="customer-home-title">Trending sets for your next appointment</h1>
          <p className="section-copy">
            Browse live style previews before the booking flow is opened up.
          </p>
        </div>
        <div className="discovery-stat-grid" aria-label="Discovery stats">
          <div className="discovery-stat-card">
            <span>Styles</span>
            <strong>{styles.length}</strong>
          </div>
          <div className="discovery-stat-card">
            <span>Preview range</span>
            <strong>
              ${lowestPrice} - ${highestPrice}
            </strong>
          </div>
        </div>
      </section>

      <StyleWaterfallGrid styles={styles} />
    </MobileLayout>
  );
}
