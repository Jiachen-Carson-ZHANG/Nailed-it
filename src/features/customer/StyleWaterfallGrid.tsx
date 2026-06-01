import type { NailStyleCard } from '@/domain/nail';
import { EmptyState } from '@/components/ui/EmptyState';
import { StyleCard } from './StyleCard';

type StyleWaterfallGridProps = {
  styles: NailStyleCard[];
};

export function StyleWaterfallGrid({ styles }: StyleWaterfallGridProps) {
  return (
    <section aria-labelledby="trending-style-grid-title" className="discovery-section">
      <div className="section-heading">
        <div>
          <p className="section-eyebrow">Trending now</p>
          <h2 id="trending-style-grid-title">Discover trending nail looks</h2>
        </div>
      </div>
      {styles.length === 0 ? (
        <EmptyState
          body="No trending styles right now — check back soon."
          title="No styles yet"
        />
      ) : (
        <div className="style-waterfall-grid">
          {styles.map((style) => (
            <StyleCard key={style.id} style={style} />
          ))}
        </div>
      )}
    </section>
  );
}
