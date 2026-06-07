'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ImageUploader, type SelectedNailImage } from '@/components/ui/ImageUploader';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { saveCustomerBookingDraft } from '@/domain/booking-draft';
import { saveBreakdownResult, getBreakdownResult } from '@/domain/breakdown-store';
import { consumeTryOnImage } from '@/domain/tryon-image-store';
import type { AIRecognitionResult, BreakdownResult, RuleBasedQuote, StylePreviewQuote } from '@/domain/nail';
import {
  getCustomerBookingConfirmPath,
  getCustomerBookingPath,
  getCustomerStylePath,
  getCustomerTryOnPath,
} from '@/domain/session';
import { ComponentBreakdownPanel } from '@/features/customer/ComponentBreakdownPanel';
import { mockAIResult } from '@/mock/ai';
import { getStyleDefinitionById } from '@/mock/styles';

const sampleImageUrl = getStyleDefinitionById('rose-cat-eye')?.imageUrl ?? '';

type BookingStep = 'upload' | 'result';

type CustomerBookingContentProps = {
  prefillStyleId?: string;
  prefillImageUrl?: string;
  prefillTitle?: string;
  prefillDescription?: string;
  prefillPreviewQuote?: StylePreviewQuote;
  skipToResult?: boolean;
};

export function CustomerBookingContent({
  prefillStyleId,
  prefillImageUrl,
  prefillTitle,
  prefillDescription,
  prefillPreviewQuote,
  skipToResult,
}: CustomerBookingContentProps) {
  const hasPrefill = Boolean(prefillStyleId && prefillImageUrl);

  const tryOnImageOnce = useRef<SelectedNailImage | null | undefined>(undefined);
  const tryOnImage = (() => {
    if (tryOnImageOnce.current === undefined) tryOnImageOnce.current = consumeTryOnImage();
    return tryOnImageOnce.current;
  })();

  const [selectedImage, setSelectedImage] = useState<SelectedNailImage | null>(() => tryOnImage);
  const [step, setStep] = useState<BookingStep>(() => {
    if (hasPrefill) return 'result';
    if (skipToResult && getBreakdownResult()) return 'result';
    if (tryOnImage) return 'result';
    return 'upload';
  });
  const [imageUrl, setImageUrl] = useState(prefillImageUrl ?? tryOnImage?.previewUrl ?? '');
  const [breakdowns, setBreakdowns] = useState<{ glossary: BreakdownResult | null }>(
    () => ({ glossary: getBreakdownResult() })
  );

  const estimate = useMemo<RuleBasedQuote>(() => {
    if (prefillPreviewQuote) {
      return { source: 'pricing_rules', price: prefillPreviewQuote.price, duration: prefillPreviewQuote.duration };
    }
    if (breakdowns.glossary) {
      return {
        source: 'pricing_rules',
        price: breakdowns.glossary.totalPrice,
        duration: breakdowns.glossary.totalDuration,
      };
    }
    return { source: 'pricing_rules', price: 0, duration: 0 };
  }, [breakdowns.glossary, prefillPreviewQuote]);

  function selectSampleImage() {
    setImageUrl(sampleImageUrl);
    setSelectedImage(null);
    setBreakdowns({ glossary: null });
  }

  function resetUpload() {
    setImageUrl('');
    setSelectedImage(null);
    setBreakdowns({ glossary: null });
  }

  function handleImageSelected(image: SelectedNailImage) {
    setImageUrl(image.previewUrl);
    setSelectedImage(image);
    setBreakdowns({ glossary: null });
    if (step !== 'upload') setStep('upload');
  }

  function persistCurrentDraft() {
    saveCustomerBookingDraft({
      estimate,
      imageUrl,
      recognition: mockAIResult as AIRecognitionResult,
      breakdowns,
      catalogSelections: breakdowns.glossary?.catalogSelections,
      styleId: hasPrefill ? prefillStyleId : undefined,
      styleTitle: hasPrefill ? prefillTitle : undefined,
    });
  }

  function handleBreakdownResult(result: BreakdownResult) {
    saveBreakdownResult(result);
    setBreakdowns({ glossary: getBreakdownResult() });
  }

  const stepIndex: Record<BookingStep, number> = { upload: 0, result: 1 };

  return (
    <MobileLayout role="customer" title="Nailed-it">
      {!hasPrefill && (
        <div className="booking-steps" aria-label="Booking progress">
          {(['Upload', 'Style result'] as const).map((label, index) => (
            <span
              key={label}
              className={index <= stepIndex[step] ? 'booking-step booking-step-active' : 'booking-step'}
              aria-current={index === stepIndex[step] ? 'step' : undefined}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* ─── Step 1: Upload ─── */}
      {step === 'upload' && (
        <>
          <section className="page-heading">
            {hasPrefill ? (
              <>
                <p className="section-eyebrow">Analyze style</p>
                <h1>{prefillTitle}</h1>
              </>
            ) : (
              <>
                <p className="section-eyebrow">Step 1</p>
                <h1>Upload your nail reference</h1>
              </>
            )}
          </section>

          <ImageUploader
            imageUrl={imageUrl}
            onImageSelected={handleImageSelected}
            onMockUpload={selectSampleImage}
            onReset={resetUpload}
            hideControls={hasPrefill}
            tryOnHref={getCustomerTryOnPath()}
            analyzeAction={
              <Button block onClick={() => setStep('result')}>
                Analyze my photo
              </Button>
            }
          />
        </>
      )}

      {/* ─── Step 2: Result + Book ─── */}
      {step === 'result' && (
        <>
          <section className="page-heading">
            {hasPrefill ? (
              <>
                <p className="section-eyebrow">Style breakdown</p>
                <h1>{prefillTitle}</h1>
              </>
            ) : (
              <>
                <p className="section-eyebrow">Step 2</p>
                <h1>Style detected</h1>
              </>
            )}
          </section>

          {imageUrl && (
            <div className="booking-result-preview">
              <img alt={prefillTitle ?? 'Your nail reference'} src={imageUrl} className="booking-result-image" />
            </div>
          )}

          {hasPrefill && prefillDescription && (
            <section className="summary-card">
              <p>{prefillDescription}</p>
            </section>
          )}

          <ComponentBreakdownPanel image={selectedImage} cachedResult={breakdowns.glossary} onResult={handleBreakdownResult} />

          <div className="booking-step-actions">
            {hasPrefill ? (
              <Link
                className="button button-secondary button-block"
                href={prefillStyleId ? getCustomerStylePath(prefillStyleId) : getCustomerBookingPath()}
              >
                ← Back
              </Link>
            ) : (
              <Button block variant="secondary" onClick={() => setStep('upload')}>
                ← Change photo
              </Button>
            )}
            <Link
              className="button button-primary button-block"
              href={getCustomerBookingConfirmPath()}
              onClick={persistCurrentDraft}
            >
              Book time →
            </Link>
          </div>
        </>
      )}
    </MobileLayout>
  );
}
