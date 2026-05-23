'use client';

import { useMemo, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { LoadingState } from '@/components/ui/LoadingState';
import { MobileLayout } from '@/components/layout/MobileLayout';
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
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [hasRecognitionResult, setHasRecognitionResult] = useState(false);
  const [recognition, setRecognition] = useState(mockAIResult);
  const estimate = useMemo(
    () => calculateEstimate(recognition, defaultPricingRules),
    [recognition]
  );

  function startRecognition() {
    setIsRecognizing(true);

    window.setTimeout(() => {
      setIsRecognizing(false);
      setHasRecognitionResult(true);
      setIsSheetOpen(true);
    }, 700);
  }

  return (
    <MobileLayout
      role="customer"
      subtitle="Upload a reference, review the AI breakdown, then carry the current estimate into time selection."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">AI estimate</p>
        <h1>Upload your nail reference</h1>
        <p className="section-copy">
          Start with a mock image now. The editable breakdown keeps the pricing logic tied to the
          current recognition contract.
        </p>
      </section>

      <ImageUploader imageUrl={imageUrl} onMockUpload={() => setImageUrl(uploadedReferenceUrl)} />

      {isRecognizing ? (
        <LoadingState
          body="Breaking down services, shape, style details, and add-ons before computing the latest estimate."
          title="AI is recognizing the style"
        />
      ) : hasRecognitionResult ? (
        <Button onClick={() => setIsSheetOpen(true)} variant="secondary">
          Review AI breakdown
        </Button>
      ) : (
        <Button disabled={!imageUrl} onClick={startRecognition}>
          Smart recognition
        </Button>
      )}

      {hasRecognitionResult ? (
        <section className="summary-card">
          <strong>Current recognition snapshot</strong>
          <p>{recognition.selection.otherNotes}</p>
          <p>
            Confidence {Math.round(recognition.meta.confidence * 100)}% · AI suggestion SGD{' '}
            {recognition.meta.aiSuggestedQuote.price}
          </p>
        </section>
      ) : null}

      <BottomSheet
        open={isSheetOpen}
        title="AI recognition result"
        onClose={() => setIsSheetOpen(false)}
      >
        <p className="helper-copy">
          Review the extracted attributes. The rule-based estimate updates immediately as you edit
          the recognition result.
        </p>
        <NailAttributeEditor value={recognition} onChange={setRecognition} />
      </BottomSheet>

      {hasRecognitionResult ? (
        <PriceEstimateBar
          actionHref={getCustomerBookingConfirmPath()}
          actionLabel="Next: choose time"
          duration={estimate.duration}
          price={estimate.price}
        />
      ) : null}
    </MobileLayout>
  );
}
