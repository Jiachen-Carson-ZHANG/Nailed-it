import { MobileLayout } from '@/components/layout/MobileLayout';
import { TryOnPanel } from '@/features/customer/TryOnPanel';
import { getCustomerPublishedStyleAction } from '@/lib/actions/merchant-style-actions';

type TryOnPageProps = {
  searchParams: Promise<{ styleId?: string }>;
};

export default async function CustomerTryOnPage({ searchParams }: TryOnPageProps) {
  const { styleId } = await searchParams;
  const style = styleId ? await getCustomerPublishedStyleAction(styleId) : null;
  const styleImageUrl = style?.imageUrl ?? '';

  return (
    <MobileLayout role="customer" title="Virtual Try-On">
      <section className="page-heading">
        <p className="section-eyebrow">Preview</p>
        <h1>Try on a style</h1>
        <p className="helper-copy">
          Upload a photo of your hand and see how a nail style looks on you.
        </p>
      </section>
      <TryOnPanel prefillStyleImageUrl={styleImageUrl || undefined} styleId={styleId} />
    </MobileLayout>
  );
}
