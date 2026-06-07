import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { MerchantStyleLibrary } from '@/features/merchant/MerchantStyleLibrary';
import { getMerchantProfilePath } from '@/domain/session';

export default function MerchantStylesPage() {
  return (
    <MobileLayout role="merchant" title="Style library">
      <section className="page-heading">
        <Link className="merchant-review-back" href={getMerchantProfilePath()}>← Me</Link>
        <h1>Style library</h1>
        <p>Upload, review, and publish your designs.</p>
      </section>
      <MerchantStyleLibrary />
    </MobileLayout>
  );
}
