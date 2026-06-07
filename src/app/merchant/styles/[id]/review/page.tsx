import { MobileLayout } from '@/components/layout/MobileLayout';
import { MerchantStyleEditor } from '@/features/merchant/MerchantStyleEditor';

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
      subtitle="Edit the AI breakdown, then save or publish."
    >
      <MerchantStyleEditor styleId={id} />
    </MobileLayout>
  );
}
