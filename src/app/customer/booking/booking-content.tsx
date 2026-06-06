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
import type { AIRecognitionResult, BreakdownResult } from '@/domain/nail';
import { calculateEstimate } from '@/domain/pricing';
import { getCustomerBookingConfirmPath } from '@/domain/session';
import { ComponentBreakdownPanel } from '@/features/customer/ComponentBreakdownPanel';
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
  prefillRecognition?: AIRecognitionResult;
  skipToResult?: boolean;
};

export function CustomerBookingContent({
  prefillStyleId,
  prefillImageUrl,
  prefillTitle,
  prefillRecognition,
  skipToResult,
}: CustomerBookingContentProps) {
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
    if (skipToResult && getBreakdownResult()) return 'result';
    if (tryOnImage) return 'result';
    return 'upload';
  });
  const [imageUrl, setImageUrl] = useState(prefillImageUrl ?? '');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognition, setRecognition] = useState<AIRecognitionResult>(prefillRecognition ?? mockAIResult);
  const [recognitionError, setRecognitionError] = useState('');
  const [breakdowns, setBreakdowns] = useState<{ glossary: BreakdownResult | null }>(
    () => ({ glossary: getBreakdownResult() })
  );

  // When the page mounts with a prefill image, convert the remote URL to a
  // SelectedNailImage so it can be sent to the recognition API without an upload.
  useEffect(() => {
    if (!prefillImageUrl) return;
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
  }, [prefillImageUrl]);

  const estimate = useMemo(
    () => calculateEstimate(recognition, defaultPricingRules),
    [recognition]
  );

  async function startRecognition() {
    setIsRecognizing(true);
    setRecognitionError('');

    try {
      const nextRecognition = selectedImage
        ? await requestLiveRecognition(selectedImage)
        : await getSampleRecognition();

      setRecognition(nextRecognition);
      setStep('result');
    } catch (error) {
      setRecognitionError(
        error instanceof Error
          ? error.message
          : 'Recognition failed. Check the image and Gemini API key, then try again.'
      );
    } finally {
      setIsRecognizing(false);
    }
  }

  function selectSampleImage() {
    setImageUrl(sampleImageUrl);
    setSelectedImage(null);
    setRecognitionError('');
  }

  function handleImageSelected(image: SelectedNailImage) {
    setImageUrl(image.previewUrl);
    setSelectedImage(image);
    setRecognitionError('');
    setBreakdowns({ glossary: null }); // clear stale cache so panel re-analyses the new image
    if (step !== 'upload') setStep('upload');
  }

  function persistCurrentDraft() {
    saveCustomerBookingDraft({ estimate, imageUrl, recognition, breakdowns });
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
        <div className="booking-steps" aria-label="Booking progress">
          {(['Upload', 'Style result', 'Quote'] as const).map((label, index) => (
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

          {/* hideControls when image is already provided via prefill */}
          <ImageUploader
            imageUrl={imageUrl}
            onImageSelected={handleImageSelected}
            onMockUpload={selectSampleImage}
            hideControls={hasPrefill}
          />

          {isRecognizing ? (
            <LoadingState
              body="Breaking down services, shape, style details, and add-ons."
              title="AI is recognizing the style"
            />
          ) : (
            <Button block disabled={!imageUrl} onClick={startRecognition}>
              Analyze my photo
            </Button>
          )}

          {!imageUrl && !isRecognizing ? (
            <p className="helper-copy">Add a photo above to get your quote.</p>
          ) : null}

          {recognitionError ? (
            <section className="summary-card" role="alert">
              <strong>Recognition needs attention</strong>
              <p>{recognitionError}</p>
            </section>
          ) : null}
        </>
      )}

      {/* ─── Step 2: AI Result ─── */}
      {step === 'result' && (
        <>
          <section className="page-heading">
            <p className="section-eyebrow">Step 2</p>
            <h1>Style detected</h1>
          </section>

          {imageUrl && (
            <div className="booking-result-preview">
              <img alt="Your nail reference" src={imageUrl} className="booking-result-image" />
            </div>
          )}

          <ComponentBreakdownPanel image={selectedImage} cachedResult={breakdowns.glossary} onResult={handleBreakdownResult} />

          <div className="booking-step-actions">
            <Button block variant="secondary" onClick={() => setStep('upload')}>
              ← Change photo
            </Button>
            <Button block onClick={() => setStep('quote')}>
              See my quote →
            </Button>
          </div>
        </>
      )}

      {/* ─── Step 3: Quote ─── */}
      {step === 'quote' && (
        <>
          <section className="page-heading">
            <p className="section-eyebrow">Step 3</p>
            <h1>Your quote</h1>
          </section>

          <RecognitionPreview imageUrl={imageUrl} recognition={recognition} />

          {breakdowns.glossary && (
            <section className="summary-card">
              <p>AI estimate: <strong>{breakdowns.glossary.totalDuration} min · ${breakdowns.glossary.totalPrice.toFixed(2)}</strong></p>
            </section>
          )}

          <div className="booking-step-actions">
            <Button block variant="secondary" onClick={() => setStep('result')}>
              ← Back to adjust details
            </Button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link
              className="button button-primary button-compact"
              href={getCustomerBookingConfirmPath()}
              onClick={persistCurrentDraft}
            >
              Next: choose time
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

async function requestLiveRecognition(image: SelectedNailImage): Promise<AIRecognitionResult> {
  const response = await fetch('/api/ai/recognize-nail-style', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: image.imageBase64,
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
