'use client';

import { useMemo, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ImageUploader, type SelectedNailImage } from '@/components/ui/ImageUploader';
import { LoadingState } from '@/components/ui/LoadingState';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { saveCustomerBookingDraft } from '@/domain/booking-draft';
import type { AIRecognitionResult } from '@/domain/nail';
import { calculateEstimate } from '@/domain/pricing';
import { getCustomerBookingConfirmPath } from '@/domain/session';
import { NailAttributeEditor } from '@/features/customer/NailAttributeEditor';
import { PriceEstimateBar } from '@/features/customer/PriceEstimateBar';
import { ComponentBreakdownPanel } from '@/features/customer/ComponentBreakdownPanel';
import { mockAIResult } from '@/mock/ai';
import { defaultPricingRules } from '@/mock/pricing';
import { getStyleDefinitionById } from '@/mock/styles';

const uploadedReferenceUrl = getStyleDefinitionById('rose-cat-eye')?.imageUrl ?? '';

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
        <p>Confidence {Math.round(recognition.meta.confidence * 100)}%</p>
      </section>
    </>
  );
}

type BookingStep = 'upload' | 'result' | 'quote';

export default function CustomerBookingPage() {
  const [step, setStep] = useState<BookingStep>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedNailImage | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [recognition, setRecognition] = useState(mockAIResult);
  const [recognitionError, setRecognitionError] = useState('');
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
    setImageUrl(uploadedReferenceUrl);
    setSelectedImage(null);
    setRecognitionError('');
  }

  function handleImageSelected(image: SelectedNailImage) {
    setImageUrl(image.previewUrl);
    setSelectedImage(image);
    setRecognitionError('');
    if (step !== 'upload') setStep('upload');
  }

  function persistCurrentDraft() {
    saveCustomerBookingDraft({
      estimate,
      imageUrl,
      recognition
    });
  }

  const stepIndex: Record<BookingStep, number> = { upload: 0, result: 1, quote: 2 };

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      {/* Step indicator */}
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

      {/* ─── Step 1: Upload ─── */}
      {step === 'upload' && (
        <>
          <section className="page-heading">
            <p className="section-eyebrow">Step 1</p>
            <h1>Upload your nail reference</h1>
          </section>

          <ImageUploader
            imageUrl={imageUrl}
            onImageSelected={handleImageSelected}
            onMockUpload={selectSampleImage}
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

          <RecognitionPreview imageUrl={imageUrl} recognition={recognition} />

          <NailAttributeEditor value={recognition} onChange={setRecognition} />

          <ComponentBreakdownPanel image={selectedImage} />

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

          <Button block variant="secondary" onClick={() => setIsSheetOpen(true)}>
            Adjust style details
          </Button>

          <BottomSheet
            open={isSheetOpen}
            title="Your style breakdown"
            onClose={() => setIsSheetOpen(false)}
          >
            <p className="helper-copy">
              Adjust the style details below — your quote updates instantly.
            </p>
            <NailAttributeEditor value={recognition} onChange={setRecognition} />
          </BottomSheet>

          <div className="booking-step-actions">
            <Button block variant="secondary" onClick={() => setStep('result')}>
              ← Back to details
            </Button>
          </div>

          <PriceEstimateBar
            actionHref={getCustomerBookingConfirmPath()}
            actionLabel="Next: choose time"
            duration={estimate.duration}
            onAction={persistCurrentDraft}
            price={estimate.price}
          />
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
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      imageBase64: image.imageBase64,
      mimeType: image.mimeType
    })
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
