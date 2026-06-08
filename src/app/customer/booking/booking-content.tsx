'use client';

import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { ImageUploader, type SelectedNailImage } from '@/components/ui/ImageUploader';
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

function RecognitionPreview({ imageUrl }: { imageUrl: string }) {
  if (!imageUrl) return null;
  return (
    <div className="booking-result-preview">
      <img alt="Your nail reference" src={imageUrl} className="booking-result-image" />
    </div>
  );
}

type BookingStep = 'upload' | 'result' | 'quote';

function isSameBreakdownResult(left: BreakdownResult | null, right: BreakdownResult): boolean {
  if (!left) return false;
  if (left.totalPrice !== right.totalPrice || left.totalDuration !== right.totalDuration || left.mode !== right.mode) {
    return false;
  }
  if (left.catalogSelections.length !== right.catalogSelections.length || left.items.length !== right.items.length) {
    return false;
  }

  return (
    left.catalogSelections.every((selection, index) => {
      const target = right.catalogSelections[index];
      return selection.catalogItemId === target?.catalogItemId && selection.quantity === target?.quantity;
    }) &&
    left.items.every((item, index) => {
      const target = right.items[index];
      return (
        item.glossaryId === target?.glossaryId &&
        item.quantity === target?.quantity &&
        item.price === target?.price &&
        item.duration === target?.duration
      );
    })
  );
}

type CustomerBookingContentProps = {
  prefillStyleId?: string;
  prefillImageUrl?: string;
  prefillTitle?: string;
  prefillDescription?: string;
  prefillRecognition?: AIRecognitionResult;
  prefillPreviewQuote?: StylePreviewQuote;
  defaultExampleImageUrl?: string;
  skipToResult?: boolean;
};

export function CustomerBookingContent({
  prefillStyleId,
  prefillImageUrl,
  prefillTitle,
  prefillDescription,
  prefillRecognition,
  prefillPreviewQuote,
  defaultExampleImageUrl,
  skipToResult,
}: CustomerBookingContentProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
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
    setRecognitionError('');

    try {
      // 中文注释：示例图只有 imageUrl 时，先把它补成和用户上传一致的 SelectedNailImage，
      // 再走真实识别接口，保证两条路径的 AI 流程一致。
      const recognitionImage = selectedImage ?? await createSelectedImageFromUrl(imageUrl);

      if (recognitionImage && !selectedImage) {
        setSelectedImage(recognitionImage);
      }

      const nextRecognition = recognitionImage
        ? await requestLiveRecognition(recognitionImage, language)
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
    }
  }

  function selectSampleImage() {
    // 中文注释：预约页的“示例图”优先使用服务端传入的主页款式图片，避免这里再写死某个 mock 款。
    setImageUrl(defaultExampleImageUrl ?? '');
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
    // 中文注释：data URL 可能把 sessionStorage 撑爆，持久化草稿时只保留可安全存储的图片地址。
    const persistableImageUrl = imageUrl.startsWith('data:') ? '' : imageUrl;
    saveCustomerBookingDraft({
      estimate,
      imageUrl: persistableImageUrl,
      recognition,
      breakdowns,
      catalogSelections: breakdowns.glossary?.catalogSelections,
      styleId: hasPrefill ? prefillStyleId : undefined,
      styleTitle: hasPrefill ? prefillTitle : undefined,
    });
  }

  // When arriving from a style card, skip the quote step entirely — save the draft and go straight to confirm.
  useEffect(() => {
    if (!hasPrefill) return;
    saveCustomerBookingDraft({
      estimate,
      imageUrl,
      recognition,
      breakdowns,
      catalogSelections: breakdowns.glossary?.catalogSelections,
      styleId: prefillStyleId,
      styleTitle: prefillTitle,
    });
    router.replace(getCustomerBookingConfirmPath());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBreakdownResult = useCallback((result: BreakdownResult) => {
    saveBreakdownResult(result);
    // 中文注释：结果页会在 hydration 后再次触发 onResult；相同结果不再回灌，避免父子之间形成重复更新。
    setBreakdowns((prev) => (isSameBreakdownResult(prev.glossary, result) ? prev : { glossary: result }));
  }, []);

  // 中文注释：只有拿到 breakdown 报价结果后，结果页才显示“查看我的报价”，
  // 这样分析中和失败态都会继续隐藏这个入口。
  const hasQuoteResult = Boolean(breakdowns.glossary);
  const stepIndex: Record<BookingStep, number> = { upload: 0, result: 1, quote: 2 };

  // Suppress all rendering while the redirect to confirm is in flight.
  if (hasPrefill) return null;

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

          {recognitionError ? (
            <section className="summary-card" role="alert">
              <strong>{t('booking.result.errorTitle')}</strong>
              <p>{recognitionError}</p>
            </section>
          ) : null}
          <ComponentBreakdownPanel image={selectedImage} cachedResult={breakdowns.glossary} onResult={handleBreakdownResult} />

          <div className="booking-step-actions">
            <Button block variant="secondary" onClick={() => setStep('upload')}>
              ← {t('booking.upload.changePhoto')}
            </Button>
            {hasQuoteResult ? (
              <Link
                className="button button-primary button-block"
                href={getCustomerBookingConfirmPath()}
                onClick={persistCurrentDraft}
              >
                {t('booking.quote.next')}
              </Link>
            ) : null}
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
            <RecognitionPreview imageUrl={imageUrl} />
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

function createSelectedImageFromUrl(imageUrl: string): Promise<SelectedNailImage | null> {
  if (!imageUrl) {
    return Promise.resolve(null);
  }

  if (imageUrl.startsWith('data:')) {
    return Promise.resolve(parseDataUrlImage(imageUrl));
  }

  return fetch(imageUrl)
    .then((response) => response.blob())
    .then(readBlobAsSelectedImage(imageUrl))
    .catch(() => null);
}

function parseDataUrlImage(imageUrl: string): SelectedNailImage | null {
  const [header, imageBase64 = ''] = imageUrl.split(',', 2);
  const mimeTypeMatch = header.match(/^data:(.*?);base64$/);
  const mimeType = mimeTypeMatch?.[1] ?? '';

  if (!imageBase64 || !mimeType) {
    return null;
  }

  return {
    imageBase64,
    mimeType,
    previewUrl: imageUrl,
  };
}

function readBlobAsSelectedImage(previewUrl: string) {
  return (blob: Blob): Promise<SelectedNailImage | null> =>
    new Promise((resolve) => {
      const reader = new FileReader();

      reader.addEventListener('load', () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        const imageBase64 = dataUrl.split(',')[1] ?? '';

        if (!imageBase64) {
          resolve(null);
          return;
        }

        resolve({
          imageBase64,
          mimeType: blob.type || 'image/jpeg',
          previewUrl,
        });
      });

      reader.addEventListener('error', () => resolve(null));
      reader.readAsDataURL(blob);
    });
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
