import { glossaryById } from '@/data/glossary';
import { loadGlossarySettings } from '@/data/glossary-settings-store';
import type { AppLanguage } from '@/i18n/types';

export const COLOR_EFFECT_IDS = [
  'color_split', 'solid_color', 'gradient', 'aura_blush', 'ink_wash', 'jelly_translucent',
  'cat_eye', 'glitter', 'matte_top', 'magnetic_special_effect',
] as const;

export const breakdownPanelCopy = {
  'zh-CN': {
    units: {
      per_set: '每套',
      per_finger: '每指',
      per_piece: '每颗',
      fixed: '每次',
      per_level: '级',
      included: '含',
      tag_only: '每套',
      set: '套',
      finger: '指',
      piece: '颗',
    },
    summaryTotalPrice: '总价',
    summaryTotalDuration: '总时长',
    minutes: (n: number) => `${n} 分钟`,
    collapse: '收起',
    effectsTitle: '款式效果',
    colorEffects: '颜色效果',
    artEffects: '艺术效果',
    decoEffects: '装饰效果',
    removal: '卸甲',
    structure: '建构 / 延长',
    shapeColor: '甲型 / 颜色',
    nailShape: '甲型',
    nailLength: '甲长',
    texture: '质感',
    baseColor: '底色（可多选）',
    priceDetail: '单价明细',
    colItem: '项目',
    colDuration: '时长',
    colAmount: '金额',
    reanalyze: '重新分析',
    loadingTitle: 'AI 识别中',
    loadingBody: '正在从图片识别甲型与款式…',
    errorTitle: '分析失败',
    imageAlt: '当前款式图片',
    breakdownFailed: '分析失败。',
    tableAria: '收费项目明细',
    total: '总计',
    noValue: '—',
    artGroups: [
      { label: '法式', ids: ['french_tip_basic', 'french_tip_special'] },
      { label: '手绘', ids: ['hand_paint_simple', 'hand_paint_medium', 'hand_paint_complex'] },
      { label: '线条/图案/立体', ids: ['line_art', 'pattern_art', '3d_art'] },
    ],
    decoGroups: [
      { label: '贴纸', ids: ['sticker'] },
      { label: '贴钻', ids: ['rhinestone_small', 'rhinestone_large', 'rhinestone_heavy'] },
      { label: '饰品', ids: ['pearl', 'metal_charm', 'bow_charm', 'chain_charm', 'shell_piece'] },
      { label: '箔片', ids: ['foil_piece'] },
      { label: '蹭粉', ids: ['chrome_powder', 'aurora_powder', 'pearl_powder'] },
    ],
  },
  en: {
    units: {
      per_set: 'per set',
      per_finger: 'per finger',
      per_piece: 'per piece',
      fixed: 'per visit',
      per_level: 'level',
      included: 'incl.',
      tag_only: 'per set',
      set: 'set',
      finger: 'finger',
      piece: 'piece',
    },
    summaryTotalPrice: 'Total',
    summaryTotalDuration: 'Duration',
    minutes: (n: number) => `${n} min`,
    collapse: 'Collapse',
    effectsTitle: 'Style effects',
    colorEffects: 'Color effects',
    artEffects: 'Art details',
    decoEffects: 'Decorations',
    removal: 'Removal',
    structure: 'Builder / extension',
    shapeColor: 'Shape & colour',
    nailShape: 'Shape',
    nailLength: 'Length',
    texture: 'Finish',
    baseColor: 'Base colour (multi-select)',
    priceDetail: 'Line items',
    colItem: 'Item',
    colDuration: 'Duration',
    colAmount: 'Amount',
    reanalyze: 'Re-analyse',
    loadingTitle: 'AI analysis in progress',
    loadingBody: 'Detecting nail shape and style from the image…',
    errorTitle: 'Analysis failed',
    imageAlt: 'Current style',
    breakdownFailed: 'Breakdown failed.',
    tableAria: 'Priced line items',
    total: 'Total',
    noValue: '—',
    artGroups: [
      { label: 'French', ids: ['french_tip_basic', 'french_tip_special'] },
      { label: 'Hand-painted', ids: ['hand_paint_simple', 'hand_paint_medium', 'hand_paint_complex'] },
      { label: 'Lines / patterns / 3D', ids: ['line_art', 'pattern_art', '3d_art'] },
    ],
    decoGroups: [
      { label: 'Stickers', ids: ['sticker'] },
      { label: 'Rhinestones', ids: ['rhinestone_small', 'rhinestone_large', 'rhinestone_heavy'] },
      { label: 'Charms', ids: ['pearl', 'metal_charm', 'bow_charm', 'chain_charm', 'shell_piece'] },
      { label: 'Foil', ids: ['foil_piece'] },
      { label: 'Powders', ids: ['chrome_powder', 'aurora_powder', 'pearl_powder'] },
    ],
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

export type BreakdownPanelCopy = (typeof breakdownPanelCopy)[AppLanguage];

export function resolveUnitLabel(id: string, language: AppLanguage): string {
  const copy = breakdownPanelCopy[language];
  const settings = loadGlossarySettings();
  const s = settings.find((x) => x.id === id);
  const entry = glossaryById.get(id);
  const unit = s?.unit ?? entry?.default_pricing_unit ?? '';
  return copy.units[unit as keyof typeof copy.units] ?? unit;
}

export function entryDisplayName(id: string, language: AppLanguage): string {
  const entry = glossaryById.get(id);
  if (!entry) return id;
  return language === 'zh-CN' ? entry.name_zh : entry.name_en;
}
