import type { SelectedNailImage } from '@/components/ui/ImageUploader';

// 中文注释：记住拼贴小屋最近一次生成的成图。用户从结果页跳去试戴/识别后再按"返回"，
// 首页会重新挂载 CollageHousePanel，这里让它据此直接恢复到结果页，而不是回到入口卡片。
// 与其它 store 一样是模块级单例；调用 clear 才清除（返回时要保留，故读取不清空）。
let lastImage: SelectedNailImage | null = null;

export function saveCollageResult(image: SelectedNailImage): void {
  lastImage = image;
}

/** Peek at the last generated collage image without clearing it (needed for back-navigation). */
export function getCollageResult(): SelectedNailImage | null {
  return lastImage;
}

export function clearCollageResult(): void {
  lastImage = null;
}
