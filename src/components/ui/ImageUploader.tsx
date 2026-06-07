import type { ChangeEvent, ReactNode } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/i18n/context';
import { Button } from './Button';

export type SelectedNailImage = {
  imageBase64: string;
  mimeType: string;
  previewUrl: string;
};

type ImageUploaderProps = {
  imageUrl: string;
  onMockUpload: () => void;
  onImageSelected?: (image: SelectedNailImage) => void;
  /** "Change photo" → clear the current image and return to a fresh upload state. */
  onReset?: () => void;
  hideControls?: boolean;
  /** Try-on entry, only shown once an image exists. */
  tryOnHref?: string;
  /** Full-width primary action below the row once an image exists — e.g. Analyze. */
  analyzeAction?: ReactNode;
};

export function ImageUploader({
  imageUrl,
  onImageSelected,
  onMockUpload,
  onReset,
  hideControls,
  tryOnHref,
  analyzeAction,
}: ImageUploaderProps) {
  const { t } = useLanguage();
  const hasImage = Boolean(imageUrl);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !onImageSelected) {
      return;
    }

    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const previewUrl = typeof reader.result === 'string' ? reader.result : '';
      const imageBase64 = previewUrl.split(',')[1] ?? '';

      if (!imageBase64) {
        return;
      }

      onImageSelected({
        imageBase64,
        mimeType: file.type || 'image/jpeg',
        previewUrl
      });
    });
    reader.readAsDataURL(file);
  }

  return (
    <section className="image-uploader">
      {hasImage ? (
        <div className="image-uploader-dropzone image-uploader-static">
          <img alt="Uploaded nail reference" src={imageUrl} />
        </div>
      ) : (
        // Empty state: the whole drop-zone (placeholder + plus) opens the picker.
        <label className="image-uploader-dropzone">
          <div className="image-uploader-placeholder">
            <span className="image-uploader-mark">+</span>
          </div>
          <input
            aria-label={t('booking.upload.uploadPhoto')}
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            hidden
            type="file"
            onChange={handleFileChange}
          />
        </label>
      )}

      <div className="image-uploader-copy">
        <strong>{hasImage ? t('booking.result.title') : t('booking.upload.title')}</strong>
        <p>
          {hasImage
            ? t('booking.upload.changePhoto')
            : t('booking.upload.example')}
        </p>
      </div>

      {!hideControls && (
        hasImage ? (
          <>
            <div className="uploader-actions">
              <Button className="uploader-action" onClick={onReset} variant="secondary">
                {t('booking.upload.changePhoto')}
              </Button>
              {tryOnHref ? (
                <Link className="button button-secondary button-default uploader-action" href={tryOnHref}>
                  Try on this look
                </Link>
              ) : null}
            </div>
            {analyzeAction}
          </>
        ) : (
          <div className="uploader-actions">
            <label className="button button-primary button-default uploader-action">
              Upload or take photo
              <input
                aria-label={t('booking.upload.choosePhoto')}
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                hidden
                type="file"
                onChange={handleFileChange}
              />
            </label>
            <Button className="uploader-action" onClick={onMockUpload} variant="secondary">
              {t('booking.upload.example')}
            </Button>
          </div>
        )
      )}
    </section>
  );
}
