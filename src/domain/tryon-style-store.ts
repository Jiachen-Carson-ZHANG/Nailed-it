import type { SelectedNailImage } from '@/components/ui/ImageUploader';

// 中文注释：把一张已生成的美甲设计图（如拼贴小屋的成图）交给试戴页作为"款式图"预填，
// 免去用户重新上传。与 tryon-image-store 一样是模块级单例，读取即清空。
let pending: SelectedNailImage | null = null;

export function saveTryOnStyleImage(image: SelectedNailImage): void {
  pending = image;
}

/** Consume the stored style image (clears it after reading). */
export function consumeTryOnStyleImage(): SelectedNailImage | null {
  const img = pending;
  pending = null;
  return img;
}
