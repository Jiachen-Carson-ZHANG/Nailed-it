import { Button } from './Button';

type ImageUploaderProps = {
  imageUrl: string;
  onMockUpload: () => void;
};

export function ImageUploader({ imageUrl, onMockUpload }: ImageUploaderProps) {
  const hasImage = Boolean(imageUrl);

  return (
    <section className="image-uploader">
      {hasImage ? (
        <img alt="Uploaded nail reference" src={imageUrl} />
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
            : 'Use a mock upload now and wire this to a real picker later.'}
        </p>
      </div>
      <Button onClick={onMockUpload} variant={hasImage ? 'secondary' : 'primary'}>
        {hasImage ? 'Change reference' : 'Upload or take photo'}
      </Button>
    </section>
  );
}
