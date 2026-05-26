import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getTrendingStyles } from '@/mock/styles';
import { StyleWaterfallGridClient } from '@/features/customer/StyleWaterfallGridClient';
import { getCustomerBookingPath } from '@/domain/session';

export default function CustomerHomePage() {
  const styles = getTrendingStyles();
  const priceRange = styles.reduce<
    | {
        lowestPrice: number;
        highestPrice: number;
      }
    | undefined
  >((range, style) => {
    if (!range) {
      return {
        lowestPrice: style.previewQuote.price,
        highestPrice: style.previewQuote.price
      };
    }

    return {
      lowestPrice: Math.min(range.lowestPrice, style.previewQuote.price),
      highestPrice: Math.max(range.highestPrice, style.previewQuote.price)
    };
  }, undefined);

  return (
    <MobileLayout role="customer" title="Nailed-it">
      <section className="discovery-hero" aria-labelledby="customer-home-title">
        <div>
          <p className="section-eyebrow">For you</p>
          <h1 id="customer-home-title">Pick a look. Get an instant quote.</h1>
          <p className="section-copy">
            Tap any style for the price and time. Or upload your own photo to start.
          </p>
        </div>
        <div className="discovery-stat-grid" aria-label="Discovery stats">
          <div className="discovery-stat-card">
            <span>Styles</span>
            <strong>{styles.length}</strong>
          </div>
          <div className="discovery-stat-card">
            <span>{priceRange ? 'Preview range' : 'Feed status'}</span>
            {priceRange ? (
              <strong>
                ${priceRange.lowestPrice} - ${priceRange.highestPrice}
              </strong>
            ) : (
              <strong>Waiting for styles</strong>
            )}
          </div>
        </div>
        <Link className="button button-primary" href={getCustomerBookingPath()}>
          Book from my own photo →
        </Link>
      </section>

      <StyleWaterfallGridClient styles={styles} />
    </MobileLayout>
  );
}
