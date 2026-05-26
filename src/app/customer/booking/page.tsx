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
import { mockAIResult } from '@/mock/ai';
import { defaultPricingRules } from '@/mock/pricing';
import { getStyleDefinitionById } from '@/mock/styles';

const uploadedReferenceUrl = getStyleDefinitionById('rose-cat-eye')?.imageUrl ?? '';

export default function CustomerBookingPage() {
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImage, setSelectedImage] = useState<SelectedNailImage | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [hasRecognitionResult, setHasRecognitionResult] = useState(false);
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
      setHasRecognitionResult(true);
      setIsSheetOpen(true);
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
    setHasRecognitionResult(false);
  }

  function persistCurrentDraft() {
    saveCustomerBookingDraft({
      estimate,
      imageUrl,
      recognition
    });
  }

  return (
    <MobileLayout
      role="customer"
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Get your quote</p>
        <h1>Upload your nail reference</h1>
        <p className="section-copy">
          Choose a nail photo below to get your instant style quote.
        </p>
      </section>

      <ImageUploader
        imageUrl={imageUrl}
        onImageSelected={handleImageSelected}
        onMockUpload={selectSampleImage}
      />

      {isRecognizing ? (
        <LoadingState
          body="Breaking down services, shape, style details, and add-ons before computing the latest estimate."
          title="AI is recognizing the style"
        />
      ) : hasRecognitionResult ? (
        <Button onClick={() => setIsSheetOpen(true)} variant="secondary">
          View your estimate
        </Button>
      ) : (
        <>
          <Button disabled={!imageUrl} onClick={startRecognition}>
            Analyze my photo
          </Button>
          {!imageUrl ? (
            <p className="helper-copy">Add a photo above to get your quote.</p>
          ) : null}
        </>
      )}

      {recognitionError ? (
        <section className="summary-card" role="alert">
          <strong>Recognition needs attention</strong>
          <p>{recognitionError}</p>
        </section>
      ) : null}

      {hasRecognitionResult ? (
        <section className="summary-card">
          <strong>Style detected</strong>
          <p>{recognition.selection.otherNotes}</p>
          <p>Confidence {Math.round(recognition.meta.confidence * 100)}%</p>
        </section>
      ) : null}

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

      {hasRecognitionResult ? (
        <PriceEstimateBar
          actionHref={getCustomerBookingConfirmPath()}
          actionLabel="Next: choose time"
          duration={estimate.duration}
          onAction={persistCurrentDraft}
          price={estimate.price}
        />
      ) : null}
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
