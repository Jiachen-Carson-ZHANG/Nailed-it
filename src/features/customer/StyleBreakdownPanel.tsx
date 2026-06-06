'use client';

import { useEffect, useState } from 'react';
import { ComponentBreakdownPanel } from '@/features/customer/ComponentBreakdownPanel';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';

export function StyleBreakdownPanel({ imageUrl }: { imageUrl: string }) {
  const [image, setImage] = useState<SelectedNailImage | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    fetch(imageUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          const imageBase64 = dataUrl.split(',')[1] ?? '';
          if (imageBase64) {
            setImage({ imageBase64, mimeType: blob.type || 'image/jpeg', previewUrl: imageUrl });
          }
        });
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, [imageUrl]);

  return <ComponentBreakdownPanel image={image} />;
}
