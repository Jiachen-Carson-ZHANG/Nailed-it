'use client';

import type { NailStyleCard } from '@/domain/nail';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/i18n/context';
import { StyleCard } from './StyleCard';

type StyleWaterfallGridProps = {
  styles: NailStyleCard[];
};

export function StyleWaterfallGrid({ styles }: StyleWaterfallGridProps) {
  const { t } = useLanguage();

  return (
    <section aria-labelledby="trending-style-grid-title" className="discovery-section">
      <div className="section-heading">
        <div>
          <p className="section-eyebrow">{t('feed.trendingEyebrow')}</p>
          <h2 id="trending-style-grid-title">{t('feed.trendingTitle')}</h2>
        </div>
      </div>
      {styles.length === 0 ? (
        <EmptyState
          body={t('feed.emptyTrendingBody')}
          title={t('feed.emptyTrendingTitle')}
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
