// External-trend fixture for the 选品 agent (design spec 2026-06-27 §4). Stands in for live
// `trending-styles` (the AI Pinterest/小红书/抖音 scan) so the demo is deterministic + free. Swap to the
// live source later. Each entry = a trend label + its tag set; 选品 matches these against the catalog.
import type { ExternalTrend } from '@/domain/intelligence/trends';

export const externalTrends: ExternalTrend[] = [
  { label: '金属感', tags: ['金属感', '镜面', '银色'] }, // matches 8284 (low-conv) → price-test signal
  { label: '暗黑', tags: ['暗黑', 'Y2K', '黑色'] }, // hero understocks (≈1 style) → gap → propose 上架
  { label: '镜面猫眼', tags: ['镜面', '猫眼', '金属感'] }, // fillers carry it, hero thin → opportunity
  { label: '法式裸色', tags: ['法式风', '裸色', '清冷感'] }, // matches the hero winner 8265 → amplify
  { label: '甜美奶茶', tags: ['甜美', '奶茶', '可爱'] }, // sweet-tooth segment
];
