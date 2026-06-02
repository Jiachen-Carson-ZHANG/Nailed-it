'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { TryOnPanel } from '@/features/customer/TryOnPanel';
import { findStyleById } from '@/mock/styles';

function TryOnPageContent() {
  const searchParams = useSearchParams();
  const styleId = searchParams.get('styleId');
  const styleImageUrl = styleId ? (findStyleById(styleId)?.imageUrl ?? '') : '';

  return (
    <MobileLayout role="customer" title="Virtual Try-On">
      <section className="page-heading">
        <p className="section-eyebrow">Preview</p>
        <h1>Try on a style</h1>
        <p className="helper-copy">
          Upload a photo of your hand and see how a nail style looks on you.
        </p>
      </section>
      <TryOnPanel prefillStyleImageUrl={styleImageUrl || undefined} />
    </MobileLayout>
  );
}

export default function CustomerTryOnPage() {
  return (
    <Suspense fallback={null}>
      <TryOnPageContent />
    </Suspense>
  );
}
