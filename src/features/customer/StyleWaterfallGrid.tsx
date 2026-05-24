import type { NailStyleCard } from '@/domain/nail';
import { EmptyState } from '@/components/ui/EmptyState';
import { StyleCard } from './StyleCard';

type StyleWaterfallGridProps = {
  styles: NailStyleCard[];
};

export function StyleWaterfallGrid({ styles }: StyleWaterfallGridProps) {
  if (styles.length === 0) {
    return (
      <section aria-labelledby="trending-style-grid-title" className="discovery-section">
        <div className="section-heading">
          <div>
            <p className="section-eyebrow">Trending now</p>
            <h2 id="trending-style-grid-title">Discover trending nail looks</h2>
          </div>
          <p className="section-copy">Shared mock styles with live preview quotes from pricing rules.</p>
        </div>
        <EmptyState
          body="Add new mock styles to the shared source of truth and this feed will populate automatically."
          title="No styles are trending yet"
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="trending-style-grid-title" className="discovery-section">
      <div className="section-heading">
        <div>
          <p className="section-eyebrow">Trending now</p>
          <h2 id="trending-style-grid-title">Discover trending nail looks</h2>
        </div>
        <p className="section-copy">Shared mock styles with live preview quotes from pricing rules.</p>
      </div>
      <div className="style-waterfall-grid">
        {styles.map((style) => (
          <StyleCard key={style.id} style={style} />
        ))}
      </div>
    </section>
  );
}
