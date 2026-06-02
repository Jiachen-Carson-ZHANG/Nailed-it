import { MobileLayout } from '@/components/layout/MobileLayout';
import { getTrendingStyles } from '@/mock/styles';
import { StyleWaterfallGridClient } from '@/features/customer/StyleWaterfallGridClient';
import { TrendingStylesPanel } from '@/features/customer/TrendingStylesPanel';

export default function CustomerHomePage() {
  const styles = getTrendingStyles();

  return (
    <MobileLayout role="customer" title="Nailed-it">
      <TrendingStylesPanel />
      <StyleWaterfallGridClient styles={styles} />
    </MobileLayout>
  );
}
