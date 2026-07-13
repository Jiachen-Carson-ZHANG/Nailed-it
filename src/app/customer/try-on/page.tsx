import { getCustomerPublishedStyleAction } from '@/lib/actions/merchant-style-actions';
import { TryOnPageClient } from './try-on-page-client';

type TryOnPageProps = {
  searchParams: Promise<{ styleId?: string; imageUrl?: string }>;
};

export default async function CustomerTryOnPage({ searchParams }: TryOnPageProps) {
  const { styleId, imageUrl } = await searchParams;
  const style = styleId ? await getCustomerPublishedStyleAction(styleId) : null;
  const prefillStyleImageUrl = style?.imageUrl ?? (imageUrl ? decodeURIComponent(imageUrl) : undefined);

  return (
    <TryOnPageClient
      prefillStyleImageUrl={prefillStyleImageUrl}
      styleId={styleId}
    />
  );
}
