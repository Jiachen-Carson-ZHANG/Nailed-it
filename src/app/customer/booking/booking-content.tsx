'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ImageUploader, type SelectedNailImage } from '@/components/ui/ImageUploader';
import { LoadingState } from '@/components/ui/LoadingState';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { saveCustomerBookingDraft } from '@/domain/booking-draft';
import { saveBreakdownResult, getBreakdownResult } from '@/domain/breakdown-store';
import { consumeTryOnImage } from '@/domain/tryon-image-store';
import type { AIRecognitionResult, BreakdownResult, RuleBasedQuote, StylePreviewQuote } from '@/domain/nail';
import { calculateEstimate } from '@/domain/pricing';
import {
  getCustomerBookingConfirmPath,
  getCustomerBookingPath,
  getCustomerStylePath,
  getCustomerTryOnPath,
} from '@/domain/session';
import { ComponentBreakdownPanel } from '@/features/customer/ComponentBreakdownPanel';
import { useLanguage } from '@/i18n/context';
import { formatCurrency, formatDuration } from '@/i18n/format';
import { mockAIResult } from '@/mock/ai';
import { defaultPricingRules } from '@/mock/pricing';
import { getStyleDefinitionById } from '@/mock/styles';

const sampleImageUrl = getStyleDefinitionById('rose-cat-eye')?.imageUrl ?? '';

function RecognitionPreview({ imageUrl, recognition }: { imageUrl: string; recognition: AIRecognitionResult }) {
  return (
    <>
      {imageUrl && (
        <div className="booking-result-preview">
          <img alt="Your nail reference" src={imageUrl} className="booking-result-image" />
        </div>
      )}
      <section className="summary-card">
        <strong>{recognition.selection.otherNotes}</strong>
      </section>
    </>
  );
}

type BookingStep = 'upload' | 'result' | 'quote';

type CustomerBookingContentProps = {
  prefillStyleId?: string;
  prefillImageUrl?: string;
  prefillTitle?: string;
  prefillDescription?: string;
  prefillRecognition?: AIRecognitionResult;
  prefillPreviewQuote?: StylePreviewQuote;
  skipToResult?: boolean;
};

export function CustomerBookingContent({
  prefillStyleId,
  prefillImageUrl,
  prefillTitle,
  prefillDescription,
  prefillRecognition,
  prefillPreviewQuote,
  skipToResult,
}: CustomerBookingContentProps) {
  const { t, language } = useLanguage();
  // hasPrefill: user arrived from a style card with a known image
  const hasPrefill = Boolean(prefillStyleId && prefillImageUrl);

  // Consume once; both state initializers below read the same ref
  const tryOnImageOnce = useRef<SelectedNailImage | null | undefined>(undefined);
  const tryOnImage = (() => {
    if (tryOnImageOnce.current === undefined) tryOnImageOnce.current = consumeTryOnImage();
    return tryOnImageOnce.current;
  })();

  const [selectedImage, setSelectedImage] = useState<SelectedNailImage | null>(() => tryOnImage);
  const [step, setStep] = useState<BookingStep>(() => {
    if (hasPrefill) return 'quote';
    if (skipToResult && getBreakdownResult()) return 'result';
    if (tryOnImage) return 'result';
    return 'upload';
  });
  const [imageUrl, setImageUrl] = useState(prefillImageUrl ?? tryOnImage?.previewUrl ?? '');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognition, setRecognition] = useState<AIRecognitionResult>(prefillRecognition ?? mockAIResult);
  const [recognitionError, setRecognitionError] = useState('');
  const [breakdowns, setBreakdowns] = useState<{ glossary: BreakdownResult | null }>(
    () => ({ glossary: getBreakdownResult() })
  );

  // When the page mounts with a prefill image, convert the remote URL to a
  // SelectedNailImage so it can be sent to the recognition API without an upload.
  useEffect(() => {
    // Published styles use their frozen merchant-reviewed catalog configuration. They must not be
    // re-analysed at booking time.
    if (!prefillImageUrl || hasPrefill) return;
    fetch(prefillImageUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          const imageBase64 = dataUrl.split(',')[1] ?? '';
          if (imageBase64) {
            setSelectedImage({ imageBase64, mimeType: blob.type || 'image/jpeg', previewUrl: prefillImageUrl });
          }
        });
        reader.readAsDataURL(blob);
      })
      .catch(() => {
        // If CORS/network blocks the fetch, recognition will fall back to the URL approach
      });
  }, [hasPrefill, prefillImageUrl]);

  // For a published style the merchant's curated, server-derived quote is authoritative; fall back
  // to the rule-based estimate only for free-form photo uploads.
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
    return calculateEstimate(recognition, defaultPricingRules);
  }, [breakdowns.glossary, recognition, prefillPreviewQuote]);

  async function startRecognition() {
    // Move to step 2 immediately and show the photo; the description and the breakdown then stream in
    // there, instead of holding the user on step 1 behind a spinner.
    setStep('result');
    setIsRecognizing(true);
    setRecognitionError('');

    try {
      const nextRecognition = selectedImage
        ? await requestLiveRecognition(selectedImage, language)
        : await getSampleRecognition();

      setRecognition(nextRecognition);
    } catch (error) {
      setRecognitionError(
        error instanceof Error
          ? error.message
          : language === 'zh-CN'
            ? '识别失败了，请检查图片后再试一次。'
            : 'Recognition failed. Check the image and try again.'
      );
    } finally {
      setIsRecognizing(false);
    }
  }

  function selectSampleImage() {
    setImageUrl(sampleImageUrl);
    setSelectedImage(null);
    setRecognitionError('');
    setBreakdowns({ glossary: null });
  }

  // "Change photo" returns to a clean upload state rather than opening the picker in place.
  function resetUpload() {
    setImageUrl('');
    setSelectedImage(null);
    setRecognitionError('');
    setBreakdowns({ glossary: null });
  }

  function handleImageSelected(image: SelectedNailImage) {
    setImageUrl(image.previewUrl);
    setSelectedImage(image);
    setRecognitionError('');
    setBreakdowns({ glossary: null }); // clear stale cache so panel re-analyses the new image
    if (step !== 'upload') setStep('upload');
  }

  function persistCurrentDraft() {
    // Carry the style id so the confirm step books the merchant's curated breakdown (server-derived
    // price) rather than a flat recognition estimate.
    saveCustomerBookingDraft({
      estimate,
      imageUrl,
      recognition,
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

  const stepIndex: Record<BookingStep, number> = { upload: 0, result: 1, quote: 2 };

  return (
    <MobileLayout role="customer" title="Nailed-it">
      {/* Step indicator — hidden when arriving from a style card */}
      {!hasPrefill && (
        <div className="booking-steps" aria-label={t('booking.progress')}>
          {([t('booking.steps.upload'), t('booking.steps.result'), t('booking.steps.quote')] as const).map((label, index) => (
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
                <p className="section-eyebrow">{t('booking.upload.prefill')}</p>
                <h1>{prefillTitle}</h1>
              </>
            ) : (
              <>
                <p className="section-eyebrow">{t('booking.step1')}</p>
                <h1>{t('booking.upload.title')}</h1>
              </>
            )}
          </section>

          {/* hideControls when image is already provided via prefill. The Analyze CTA only appears
              once an image exists — before that the upload/example pair is the whole call to action. */}
          <ImageUploader
            imageUrl={imageUrl}
            onImageSelected={handleImageSelected}
            onMockUpload={selectSampleImage}
            onReset={resetUpload}
            hideControls={hasPrefill}
            tryOnHref={getCustomerTryOnPath()}
            analyzeAction={
              <Button block onClick={startRecognition}>
                {t('booking.upload.analyze')}
              </Button>
            }
          />
        </>
      )}

      {/* ─── Step 2: AI Result ─── */}
      {step === 'result' && (
        <>
          <section className="page-heading">
            <p className="section-eyebrow">{t('booking.step2')}</p>
            <h1>{t('booking.result.title')}</h1>
          </section>

          {imageUrl && (
            <div className="booking-result-preview">
              <img alt={t('booking.upload.title')} src={imageUrl} className="booking-result-image" />
            </div>
          )}

          {recognitionError ? (
            <section className="summary-card" role="alert">
              <strong>{t('booking.result.errorTitle')}</strong>
              <p>{recognitionError}</p>
            </section>
          ) : isRecognizing ? (
            <LoadingState title={t('booking.result.loadingTitle')} body={t('booking.result.loadingBody')} />
          ) : (
            <RecognitionPreview imageUrl="" recognition={recognition} />
          )}
          <ComponentBreakdownPanel image={selectedImage} cachedResult={breakdowns.glossary} onResult={handleBreakdownResult} />

          <div className="booking-step-actions">
            <Button block variant="secondary" onClick={() => setStep('upload')}>
              ← {t('booking.upload.changePhoto')}
            </Button>
            <Button block onClick={() => setStep('quote')}>
              {t('booking.result.quoteCta')} →
            </Button>
          </div>
        </>
      )}

      {/* ─── Step 3: Quote ─── */}
      {step === 'quote' && (
        <>
          <section className="page-heading">
            <p className="section-eyebrow">{t('booking.step3')}</p>
            <h1>{t('booking.quote.title')}</h1>
          </section>

          {hasPrefill ? (
            imageUrl ? (
              <div className="booking-result-preview">
                <img alt={prefillTitle ?? t('booking.result.title')} src={imageUrl} className="booking-result-image" />
              </div>
            ) : null
          ) : (
            <RecognitionPreview imageUrl={imageUrl} recognition={recognition} />
          )}

          {prefillPreviewQuote ? (
            <section className="summary-card">
              {prefillDescription ? <p>{prefillDescription}</p> : null}
              <p>
                {t('booking.quote.studioPrice')}:{' '}
                <strong>
                  {formatDuration({ minutes: estimate.duration, language })} · {formatCurrency({ cents: Math.round(estimate.price * 100) })}
                </strong>
              </p>
            </section>
          ) : (
            breakdowns.glossary && (
              <section className="summary-card">
                <p>
                  {t('booking.quote.aiEstimate')}:{' '}
                  <strong>
                    {formatDuration({ minutes: breakdowns.glossary.totalDuration, language })} · {formatCurrency({ cents: Math.round(breakdowns.glossary.totalPrice * 100) })}
                  </strong>
                </p>
              </section>
            )
          )}

          <div className="booking-step-actions">
            {hasPrefill ? (
              <Link
                className="button button-secondary button-block"
                href={prefillStyleId ? getCustomerStylePath(prefillStyleId) : getCustomerBookingPath()}
              >
                ← {t('booking.quote.back')}
              </Link>
            ) : (
              <Button block variant="secondary" onClick={() => setStep('result')}>
                ← {t('booking.quote.back')}
              </Button>
            )}
            <Link
              className="button button-primary button-block"
              href={getCustomerBookingConfirmPath()}
              onClick={persistCurrentDraft}
            >
              {t('booking.quote.next')}
            </Link>
          </div>
        </>
      )}
    </MobileLayout>
  );
}

async function getSampleRecognition(): Promise<AIRecognitionResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 700));
  return mockAIResult;
}

async function requestLiveRecognition(
  image: SelectedNailImage,
  language: 'zh-CN' | 'en'
): Promise<AIRecognitionResult> {
  const response = await fetch('/api/ai/recognize-nail-style', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: image.imageBase64,
      language,
      mimeType: image.mimeType,
    }),
  });

  const responseBody = (await response.json()) as {
    error?: string;
    recognition?: AIRecognitionResult;
  };

  if (!response.ok || !responseBody.recognition) {
    throw new Error(responseBody.error ?? 'Recognition failed. Try another image.');
  }

  return responseBody.recognition;
}
