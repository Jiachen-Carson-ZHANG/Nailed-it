import { MobileLayout } from '@/components/layout/MobileLayout';
import { PublishedStyleFeed } from '@/features/customer/PublishedStyleFeed';
import { TrendingStylesPanel } from '@/features/customer/TrendingStylesPanel';

export default function CustomerHomePage() {
  return (
    <MobileLayout role="customer" title="Nailed-it">
      <TrendingStylesPanel />
      <PublishedStyleFeed />
    </MobileLayout>
  );
}
