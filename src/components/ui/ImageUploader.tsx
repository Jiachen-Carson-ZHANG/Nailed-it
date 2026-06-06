import type { ChangeEvent } from 'react';
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
  hideControls?: boolean;
};

export function ImageUploader({ imageUrl, onImageSelected, onMockUpload, hideControls }: ImageUploaderProps) {
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
        <label style={{ cursor: 'pointer', display: 'block' }}>
          <img alt="Uploaded nail reference" src={imageUrl} />
          <input
            aria-label="Choose nail reference photo"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            hidden
            type="file"
            onChange={handleFileChange}
          />
        </label>
      ) : (
        <div className="image-uploader-placeholder" aria-hidden="true">
          <span className="image-uploader-mark">+</span>
        </div>
      )}
      <div className="image-uploader-copy">
        <strong>{hasImage ? 'Reference ready' : 'Add a nail reference'}</strong>
        <p>
          {hasImage
            ? 'Swap the current image to compare another finish or shape.'
            : 'Upload a nail photo to get your quote, or try with our example.'}
        </p>
      </div>
      {!hideControls && (
        <>
          <label className="button button-primary button-default button-block">
            Upload or take photo
            <input
              aria-label="Choose nail reference photo"
              accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
              hidden
              type="file"
              onChange={handleFileChange}
            />
          </label>
          <Button block onClick={onMockUpload} variant="secondary">
            Try with example
          </Button>
        </>
      )}
    </section>
  );
}
