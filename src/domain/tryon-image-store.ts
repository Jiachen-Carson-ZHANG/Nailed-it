import type { SelectedNailImage } from '@/components/ui/ImageUploader';

let pending: SelectedNailImage | null = null;

export function saveTryOnImage(image: SelectedNailImage): void {
  pending = image;
}

/** Consume the stored image (clears it after reading). */
export function consumeTryOnImage(): SelectedNailImage | null {
  const img = pending;
  pending = null;
  return img;
}
