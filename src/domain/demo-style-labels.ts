type AppLang = 'zh-CN' | 'en';
type DemoStyleLabel = { 'zh-CN': string; en: string };

// Curated names for the demo anchor styles. These mirror the intelligence seed narrative; they are
// only a display fallback when the DB title is missing or generic ("Melissa Design 8284").
const LABELS_BY_CODE: Readonly<Record<string, DemoStyleLabel>> = {
  '8249': { 'zh-CN': '薄荷青法式', en: 'Mint French' },
  '8254': { 'zh-CN': '奶咖拼图', en: 'Milk Coffee Mosaic' },
  '8261': { 'zh-CN': '极光甜心', en: 'Aurora Sweetheart' },
  '8265': { 'zh-CN': '极光法式碎钻', en: 'Aurora French Rhinestone' },
  '8266': { 'zh-CN': '温柔奶茶果冻', en: 'Soft Milk-Tea Jelly' },
  '8273': { 'zh-CN': '梦幻马卡龙', en: 'Pastel Macaron' },
  '8274': { 'zh-CN': '碎冰玫瑰猫眼', en: 'Iced Rose Cat-Eye' },
  '8275': { 'zh-CN': '碎钻冰花法式', en: 'Crystal Ice French' },
  '8277': { 'zh-CN': '焦糖布丁布丁狗', en: 'Caramel Pudding Pup' },
  '8282': { 'zh-CN': '清冷冰蓝冷光甲', en: 'Cool Ice-Blue Chrome' },
  '8284': { 'zh-CN': '鎏金奢华', en: 'Gilded Luxe' },
};

const DEMO_CODES = Object.keys(LABELS_BY_CODE);
const GENERIC_MELISSA_TITLE_RE = /^Melissa Design\s+\d{3,}$/i;

export function styleCodeFromId(id: unknown): string | null {
  const s = String(id ?? '').trim();
  return /(\d{3,})$/.exec(s)?.[1] ?? null;
}

export function demoStyleName(idOrCode: unknown, lang: AppLang): string | null {
  const code = styleCodeFromId(idOrCode) ?? String(idOrCode ?? '').trim();
  return LABELS_BY_CODE[code]?.[lang] ?? null;
}

export function isGenericDemoTitle(title: unknown): boolean {
  return GENERIC_MELISSA_TITLE_RE.test(String(title ?? '').trim());
}

export function demoStyleCodePattern(): RegExp {
  return new RegExp(`\\b(${DEMO_CODES.join('|')})\\b`, 'g');
}
