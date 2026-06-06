import { Suspense } from 'react';
import { getCustomerPublishedStyleAction } from '@/lib/actions/merchant-style-actions';
import { CustomerBookingContent } from './booking-content';

type BookingPageProps = {
  searchParams: Promise<{ styleId?: string }>;
};

export default async function CustomerBookingPage({ searchParams }: BookingPageProps) {
  const { styleId } = await searchParams;
  const style = styleId ? await getCustomerPublishedStyleAction(styleId) : null;

  return (
    <Suspense fallback={null}>
      <CustomerBookingContent
        prefillStyleId={styleId}
        prefillImageUrl={style?.imageUrl}
        prefillTitle={style?.title}
        prefillDescription={style?.description}
        prefillRecognition={style?.recognition ?? undefined}
        prefillPreviewQuote={style?.previewQuote}
      />
    </Suspense>
  );
}
