import type { SelectedNailImage } from '@/components/ui/ImageUploader';

// 中文注释：记住拼贴小屋最近一次生成的成图。用户从结果页跳去试戴/识别后再按"返回"，
// 首页会重新挂载 CollageHousePanel，这里让它据此直接恢复到结果页，而不是回到入口卡片。
// 与其它 store 一样是模块级单例；调用 clear 才清除（返回时要保留，故读取不清空）。

let originalImage: SelectedNailImage | null = null;
let latestImage: SelectedNailImage | null = null;

/** 首次生成时调用。同时设置 original 和 latest；后续调用不覆盖 original。 */
export function saveOriginalCollageResult(image: SelectedNailImage): void {
  if (!originalImage) {
    originalImage = image;
    latestImage = image;
  }
}

/** 局部重新生成完成后调用，只更新 latest，original 不变。 */
export function saveLatestCollageResult(image: SelectedNailImage): void {
  latestImage = image;
}

export function getCollageImages(): { original: SelectedNailImage | null; latest: SelectedNailImage | null } {
  return { original: originalImage, latest: latestImage };
}

/** Peek at the last generated collage image without clearing it (needed for back-navigation). */
export function getCollageResult(): SelectedNailImage | null {
  return latestImage;
}

export function clearCollageResult(): void {
  originalImage = null;
  latestImage = null;
}
