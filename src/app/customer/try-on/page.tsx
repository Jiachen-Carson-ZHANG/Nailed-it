import { getCustomerPublishedStyleAction } from '@/lib/actions/merchant-style-actions';
import { TryOnPageClient } from './try-on-page-client';

type TryOnPageProps = {
  searchParams: Promise<{ styleId?: string }>;
};

export default async function CustomerTryOnPage({ searchParams }: TryOnPageProps) {
  const { styleId } = await searchParams;
  const style = styleId ? await getCustomerPublishedStyleAction(styleId) : null;

  return (
    <TryOnPageClient
      prefillStyleImageUrl={style?.imageUrl ?? undefined}
      styleId={styleId}
    />
  );
}
