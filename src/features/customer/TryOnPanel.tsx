'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TryOnResult } from '@/domain/nail';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { ComponentBreakdownPanel } from '@/features/customer/ComponentBreakdownPanel';
import { getCustomerBookingPath } from '@/domain/session';

type ImageSlotProps = {
  label: string;
  description: string;
  image: SelectedNailImage | null;
  prefillImageUrl?: string;
  onImageSelected: (image: SelectedNailImage) => void;
};

function ImageSlot({ label, description, image, prefillImageUrl, onImageSelected }: ImageSlotProps) {
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
          aria-label={`Upload ${label}`}
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
  const [handImage, setHandImage] = useState<SelectedNailImage | null>(null);
  const [styleImage, setStyleImage] = useState<SelectedNailImage | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

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
        setError('Could not load the prefill style image. Please upload one manually.');
        return;
      }
    }

    if (!finalStyleBase64 || !finalStyleMime) {
      setError('Please upload a nail style reference image.');
      return;
    }

    setIsLoading(true);
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
        throw new Error(body.error ?? 'Try-on failed.');
      }

      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Try-on failed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="try-on-panel">
      <div className="try-on-slots">
        <ImageSlot
          label="Your hand"
          description="Upload a clear photo of your bare nails."
          image={handImage}
          onImageSelected={setHandImage}
        />
        <ImageSlot
          label="Nail style"
          description="Upload or use a style from the gallery."
          image={styleImage}
          prefillImageUrl={prefillStyleImageUrl}
          onImageSelected={setStyleImage}
        />
      </div>

      {error && (
        <section className="summary-card" role="alert">
          <strong>Try-on error</strong>
          <p>{error}</p>
        </section>
      )}

      {isLoading ? (
        <LoadingState
          title="Generating your try-on"
          body="Applying the style to your nails — this may take a moment."
        />
      ) : (
        <Button block disabled={!canGenerate} onClick={generate}>
          Generate try-on
        </Button>
      )}

      {result && (
        <section className="try-on-result" aria-label="Try-on result">
          <p className="section-eyebrow">Your try-on</p>
          <img
            src={`data:${result.mimeType};base64,${result.imageBase64}`}
            alt="Virtual nail try-on result"
            className="try-on-result-image"
          />
          <p className="helper-copy">
            <a
              href={`data:${result.mimeType};base64,${result.imageBase64}`}
              download="nail-try-on.png"
            >
              Download image
            </a>
          </p>
          <div className="try-on-result-actions">
            <Button
              block
              onClick={() => setShowBreakdown((v) => !v)}
            >
              {showBreakdown ? 'Hide analysis' : 'Analyze style + get quote'}
            </Button>
            <Link
              className="button button-secondary button-block"
              href={styleId ? `${getCustomerBookingPath()}?styleId=${styleId}` : getCustomerBookingPath()}
            >
              Book this look
            </Link>
          </div>
          {showBreakdown && (
            <ComponentBreakdownPanel
              image={{ imageBase64: result.imageBase64, mimeType: result.mimeType, previewUrl: `data:${result.mimeType};base64,${result.imageBase64}` }}
            />
          )}
        </section>
      )}
    </div>
  );
}
