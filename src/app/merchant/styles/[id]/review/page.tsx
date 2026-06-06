import { MobileLayout } from '@/components/layout/MobileLayout';
import { MerchantStyleReviewWorkspace } from '@/features/merchant/MerchantStyleReviewWorkspace';

type MerchantStyleReviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MerchantStyleReviewPage({ params }: MerchantStyleReviewPageProps) {
  const { id } = await params;

  return (
    <MobileLayout
      brandHref="/merchant/styles"
      role="merchant"
      showTabs={false}
      subtitle="Review the AI suggestion before customers can see it."
    >
      <MerchantStyleReviewWorkspace styleId={id} />
    </MobileLayout>
  );
}
