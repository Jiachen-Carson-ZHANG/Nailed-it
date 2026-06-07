'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TryOnResult } from '@/domain/nail';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { getCustomerBookingPath } from '@/domain/session';
import { saveTryOnImage } from '@/domain/tryon-image-store';
import { demoCustomerId } from '@/mock/customers';
import { track } from '@/features/analytics/track';
import { useLanguage } from '@/i18n/context';

type ImageSlotProps = {
  label: string;
  description: string;
  uploadAria: string;
  image: SelectedNailImage | null;
  prefillImageUrl?: string;
  onImageSelected: (image: SelectedNailImage) => void;
};

function ImageSlot({ label, description, uploadAria, image, prefillImageUrl, onImageSelected }: ImageSlotProps) {
  const previewSrc = image?.previewUrl ?? prefillImageUrl ?? '';
  const hasImage = Boolean(previewSrc);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const previewUrl = typeof reader.result === 'string' ? reader.result : '';
      const imageBase64 = previewUrl.split(',')[1] ?? '';
      if (!imageBase64) return;
      onImageSelected({ imageBase64, mimeType: file.type || 'image/jpeg', previewUrl });
    });
    reader.readAsDataURL(file);
  }

  return (
    <div className="try-on-slot">
      <p className="section-eyebrow">{label}</p>
      <label className="try-on-slot-upload">
        {hasImage ? (
          <img src={previewSrc} alt={label} className="try-on-slot-image" />
        ) : (
          <div className="try-on-slot-placeholder" aria-hidden="true">
            <span className="image-uploader-mark">+</span>
          </div>
        )}
        <input
          aria-label={uploadAria}
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          hidden
          type="file"
          onChange={handleFileChange}
        />
      </label>
      <p className="helper-copy">{description}</p>
    </div>
  );
}

type TryOnPanelProps = {
  prefillStyleImageUrl?: string;
  styleId?: string;
};

export function TryOnPanel({ prefillStyleImageUrl, styleId }: TryOnPanelProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [handImage, setHandImage] = useState<SelectedNailImage | null>(null);
  const [styleImage, setStyleImage] = useState<SelectedNailImage | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const canGenerate = Boolean(handImage) && (Boolean(styleImage) || Boolean(prefillStyleImageUrl));

  async function generate() {
    if (!handImage) return;

    let finalStyleBase64 = styleImage?.imageBase64 ?? null;
    let finalStyleMime = styleImage?.mimeType ?? null;

    if (!finalStyleBase64 && prefillStyleImageUrl) {
      try {
        const res = await fetch(prefillStyleImageUrl);
        const blob = await res.blob();
        const reader = new FileReader();
        finalStyleBase64 = await new Promise<string>((resolve) => {
          reader.addEventListener('load', () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            resolve(dataUrl.split(',')[1] ?? '');
          });
          reader.readAsDataURL(blob);
        });
        finalStyleMime = blob.type || 'image/jpeg';
      } catch {
        setError(t('tryOn.prefillLoadError'));
        return;
      }
    }

    if (!finalStyleBase64 || !finalStyleMime) {
      setError(t('tryOn.styleRequiredError'));
      return;
    }

    setIsGenerating(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/ai/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handImageBase64: handImage.imageBase64,
          handMimeType: handImage.mimeType,
          styleImageBase64: finalStyleBase64,
          styleMimeType: finalStyleMime
        })
      });

      const body = (await response.json()) as TryOnResult & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? t('tryOn.tryOnFailed'));
      }

      setResult(body);
      track('try_on_completed', {
        styleId,
        customerId: demoCustomerId,
        eventSource: 'try_on',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tryOn.tryOnFailed'));
    } finally {
      setIsGenerating(false);
    }
  }

  function analyzeAndBook() {
    if (!result) return;
    saveTryOnImage({ imageBase64: result.imageBase64, mimeType: result.mimeType, previewUrl: `data:${result.mimeType};base64,${result.imageBase64}` });
    const base = styleId ? `${getCustomerBookingPath()}?styleId=${styleId}` : getCustomerBookingPath();
    const sep = styleId ? '&' : '?';
    router.push(`${base}${sep}t=${Date.now()}`);
  }

  const handLabel = t('tryOn.handLabel');
  const styleLabel = t('tryOn.styleLabel');

  return (
    <div className="try-on-panel">
      <button type="button" className="detail-back-link detail-back-top" onClick={() => router.back()}>
        {t('tryOn.back')}
      </button>
      <div className="try-on-slots">
        <ImageSlot
          label={handLabel}
          description={t('tryOn.handDesc')}
          uploadAria={`${handLabel}`}
          image={handImage}
          onImageSelected={setHandImage}
        />
        <ImageSlot
          label={styleLabel}
          description={t('tryOn.styleDesc')}
          uploadAria={`${styleLabel}`}
          image={styleImage}
          prefillImageUrl={prefillStyleImageUrl}
          onImageSelected={setStyleImage}
        />
      </div>

      {error && (
        <section className="summary-card" role="alert">
          <strong>{t('tryOn.errorTitle')}</strong>
          <p>{error}</p>
        </section>
      )}

      {isGenerating ? (
        <LoadingState
          title={t('tryOn.loadingTitle')}
          body={t('tryOn.loadingBody')}
        />
      ) : (
        <Button block disabled={!canGenerate} onClick={generate}>
          {t('tryOn.generate')}
        </Button>
      )}

      {result && (
        <section className="try-on-result" aria-label={t('tryOn.resultEyebrow')}>
          <p className="section-eyebrow">{t('tryOn.resultEyebrow')}</p>
          <img
            src={`data:${result.mimeType};base64,${result.imageBase64}`}
            alt={t('tryOn.resultAlt')}
            className="try-on-result-image"
          />
          <p className="helper-copy">
            <a
              href={`data:${result.mimeType};base64,${result.imageBase64}`}
              download="nail-try-on.png"
            >
              {t('tryOn.download')}
            </a>
          </p>
          <div className="try-on-result-actions">
            <Button block onClick={analyzeAndBook}>
              {t('tryOn.analyzeBook')}
            </Button>
            <Button block variant="secondary" onClick={() => router.back()}>
              {t('tryOn.back')}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
