import { MobileLayout } from '@/components/layout/MobileLayout';
import { MerchantStyleLibrary } from '@/features/merchant/MerchantStyleLibrary';

export default function MerchantStylesPage() {
  return (
    <MobileLayout role="merchant" title="Style library">
      <section className="page-heading">
        <p className="section-eyebrow">Merchant showcase</p>
        <h1>Style library</h1>
        <p>Review and publish designs that customers can discover from the home feed.</p>
      </section>
      <MerchantStyleLibrary />
    </MobileLayout>
  );
}
