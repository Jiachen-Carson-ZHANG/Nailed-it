import { Suspense } from 'react';
import { getCustomerPublishedStyleAction } from '@/lib/actions/merchant-style-actions';
import { CustomerBookingContent } from './booking-content';

const DEFAULT_BOOKING_EXAMPLE_STYLE_ID = 'style-melissa-img-8265';

type BookingPageProps = {
  searchParams: Promise<{ styleId?: string; t?: string; skipToResult?: string; livePrice?: string; liveDuration?: string }>;
};

export default async function CustomerBookingPage({ searchParams }: BookingPageProps) {
  const { styleId, t, skipToResult, livePrice, liveDuration } = await searchParams;
  const [style, defaultExampleStyle] = await Promise.all([
    styleId ? getCustomerPublishedStyleAction(styleId) : Promise.resolve(null),
    getCustomerPublishedStyleAction(DEFAULT_BOOKING_EXAMPLE_STYLE_ID),
  ]);

  const livePriceCents = livePrice ? parseInt(livePrice, 10) : undefined;
  const liveDurationMin = liveDuration ? parseInt(liveDuration, 10) : undefined;

  return (
    <Suspense fallback={null}>
      <CustomerBookingContent
        key={t ?? 'initial'}
        // 中文注释：预约页默认示例图跟随主页这张已发布款式，后续想切换时只改这个默认 styleId。
        defaultExampleImageUrl={defaultExampleStyle?.imageUrl}
        prefillStyleId={styleId}
        prefillImageUrl={style?.imageUrl}
        prefillTitle={style?.title}
        prefillDescription={style?.description}
        prefillRecognition={style?.recognition ?? undefined}
        prefillPreviewQuote={style?.previewQuote}
        livePriceCents={livePriceCents}
        liveDurationMin={liveDurationMin}
        skipToResult={skipToResult === '1'}
      />
    </Suspense>
  );
}
