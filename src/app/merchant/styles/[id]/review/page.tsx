import { MerchantStyleReviewPageClient } from './review-page-client';

type MerchantStyleReviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function MerchantStyleReviewPage({ params }: MerchantStyleReviewPageProps) {
  const { id } = await params;
  return <MerchantStyleReviewPageClient styleId={id} />;
}
