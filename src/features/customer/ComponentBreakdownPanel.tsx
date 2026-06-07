'use client';

import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import type { BreakdownResult, GlossaryBreakdownItem } from '@/domain/nail';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { glossaryById, glossaryEntries } from '@/data/glossary';
import { loadGlossarySettings } from '@/data/glossary-settings-store';
import { loadCurrency } from '@/data/currency-store';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { AnalyzeChip, AddChip } from '@/features/merchant/AnalyzeChip';
import { useLanguage } from '@/i18n/context';

// ── Glossary lookup helpers ───────────────────────────────────────────────────
const byCategory = (cat: string) =>
  glossaryEntries.filter((e) => e.category === cat);

const REMOVAL_IDS   = ['removal_basic_gel', 'removal_short_extension', 'removal_extension', 'removal_with_rhinestone'];
const STRUCTURE_IDS = ['builder_gel', 'nail_tip_full_cover', 'nail_tip_half_cover', 'nail_tip_shallow_cover'];
const SHAPE_IDS     = byCategory('nail_shape').map((e) => e.id);
const LENGTH_IDS    = byCategory('nail_length').map((e) => e.id);
const TEXTURE_IDS   = byCategory('texture').map((e) => e.id);
const COLOR_IDS     = byCategory('color').map((e) => e.id);

const COLOR_EFFECT_IDS = ['color_split', 'solid_color', 'gradient', 'aura_blush', 'ink_wash', 'jelly_translucent', 'cat_eye', 'glitter', 'matte_top', 'magnetic_special_effect'];

const ART_GROUPS: { label: string; ids: string[] }[] = [
  { label: '法式',         ids: ['french_tip_basic', 'french_tip_special'] },
  { label: '手绘',         ids: ['hand_paint_simple', 'hand_paint_medium', 'hand_paint_complex'] },
  { label: '线条/图案/立体', ids: ['line_art', 'pattern_art', '3d_art'] },
];

const DECO_GROUPS: { label: string; ids: string[] }[] = [
  { label: '贴纸', ids: ['sticker'] },
  { label: '贴钻', ids: ['rhinestone_small', 'rhinestone_large', 'rhinestone_heavy'] },
  { label: '饰品', ids: ['pearl', 'metal_charm', 'bow_charm', 'chain_charm', 'shell_piece'] },
  { label: '箔片', ids: ['foil_piece'] },
  { label: '蹭粉', ids: ['chrome_powder', 'aurora_powder', 'pearl_powder'] },
];

const UNIT_ZH: Record<string, string> = {
  per_set:    '每套',
  per_finger: '每指',
  per_piece:  '每颗',
  fixed:      '每次',
  per_level:  '级',
  included:   '含',
  tag_only:   '每套',
  set:        '套',
  finger:     '指',
  piece:      '颗',
};

function resolveUnitLabel(id: string): string {
  const settings = loadGlossarySettings();
  const s = settings.find((x) => x.id === id);
  const entry = glossaryById.get(id);
  const unit = s?.unit ?? entry?.default_pricing_unit ?? '';
  return UNIT_ZH[unit] ?? unit;
}

// ── Map AI BreakdownResult → state ────────────────────────────────────────────
function seedStateFromBreakdown(result: BreakdownResult) {
  const structureIds = new Set<string>(['builder_gel']);
  let removalId: string | null = null;
  let nailShape: string | null = null;
  let nailLength: string | null = null;
  let texture: string | null = null;
  const colorIds       = new Set<string>();
  const colorEffectIds = new Set<string>();
  const artIds         = new Set<string>();
  const decoIds        = new Set<string>();
  const quantities     = new Map<string, number>();

  for (const item of result.items) {
    const entry = glossaryById.get(item.glossaryId);
    const cat = entry?.category ?? '';

    if (item.glossaryType === 'billable_component' && cat === 'structure') {
      structureIds.add(item.glossaryId);
    } else if (cat === 'removal') {
      removalId = item.glossaryId; // single-select: last wins
    } else if (cat === 'nail_shape') {
      nailShape = item.glossaryId;
    } else if (cat === 'nail_length') {
      nailLength = item.glossaryId;
    } else if (cat === 'texture') {
      texture = item.glossaryId;
    } else if (cat === 'color') {
      colorIds.add(item.glossaryId);
    } else if (cat === 'color_effect') {
      colorEffectIds.add(item.glossaryId);
    } else if (cat === 'art') {
      artIds.add(item.glossaryId);
    } else if (cat === 'decoration') {
      decoIds.add(item.glossaryId);
      if (item.quantity > 0) quantities.set(item.glossaryId, item.quantity);
    }
  }

  return { removalId, structureIds, nailShape, nailLength, texture, colorIds, colorEffectIds, artIds, decoIds, quantities };
}

// ── Rebuild BreakdownResult from current selections ───────────────────────────
function buildBreakdownResult(
  removalId: string | null,
  structureIds: Set<string>,
  nailShape: string | null,
  nailLength: string | null,
  texture: string | null,
  colorIds: Set<string>,
  colorEffectIds: Set<string>,
  artIds: Set<string>,
  decoIds: Set<string>,
  quantities: Map<string, number>,
): BreakdownResult {
  const merchantSettings = loadGlossarySettings();
  const settingsById = new Map(merchantSettings.map((s) => [s.id, s]));

  const allIds = [
    ...(removalId ? [removalId] : []),
    ...structureIds,
    ...(nailShape ? [nailShape] : []),
    ...(nailLength ? [nailLength] : []),
    ...(texture ? [texture] : []),
    ...colorIds,
    ...colorEffectIds,
    ...artIds,
    ...decoIds,
  ];

  const items: GlossaryBreakdownItem[] = [];
  for (const id of allIds) {
    const entry = glossaryById.get(id);
    if (!entry) continue;
    const s = settingsById.get(id);
    const qty = quantities.get(id) ?? 1;
    const parentEntry = entry.parent_id !== 'na' ? glossaryById.get(entry.parent_id) : undefined;
    const unit = s?.unit ?? entry.default_pricing_unit;
    items.push({
      mode: 'glossary',
      glossaryId: id,
      glossaryType: entry.type as GlossaryBreakdownItem['glossaryType'],
      nameZh: entry.name_zh,
      typeZh: entry.type_zh,
      parentId: entry.parent_id,
      parentNameZh: parentEntry?.name_zh ?? '',
      quantity: qty,
      unit,
      price: s?.price ?? 0,
      duration: s?.duration ?? entry.default_duration_min,
    });
  }

  const PRICED = new Set(['service_module', 'billable_component']);
  const totalPrice = items
    .filter((i) => PRICED.has(i.glossaryType))
    .reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalDuration = items
    .filter((i) => PRICED.has(i.glossaryType))
    .reduce((sum, i) => sum + (i.glossaryType === 'billable_component' ? i.duration * i.quantity : i.duration), 0);

  const catalogSelections = items.map((i) => ({ catalogItemId: i.glossaryId, quantity: i.quantity }));

  return { items, catalogSelections, totalPrice, totalDuration, mode: 'glossary' };
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function BreakdownSummary({ breakdown, currency }: { breakdown: BreakdownResult; currency: string }) {
  const priceStr = breakdown.totalPrice > 0
    ? `${breakdown.totalPrice.toFixed(2)} ${currency}`
    : '—';
  const durationStr = breakdown.totalDuration > 0
    ? `${breakdown.totalDuration} 分钟`
    : '—';

  return (
    <div className="analyze-summary-bar">
      <div className="analyze-summary-item">
        <span className="analyze-summary-label">总价</span>
        <span className="analyze-summary-value" key={priceStr}>{priceStr}</span>
      </div>
      <div className="analyze-summary-divider" />
      <div className="analyze-summary-item">
        <span className="analyze-summary-label">总时长</span>
        <span className="analyze-summary-value" key={durationStr}>{durationStr}</span>
      </div>
    </div>
  );
}

// ── ChipGroup ─────────────────────────────────────────────────────────────────
function ChipGroup({
  ids,
  activeIds,
  mode = 'multi',
  onToggle,
  quantities,
  onQuantityChange,
  showAdd = false,
}: {
  ids: string[];
  activeIds: Set<string> | string | null;
  mode?: 'single' | 'multi';
  onToggle: (id: string) => void;
  quantities?: Map<string, number>;
  onQuantityChange?: (id: string, n: number) => void;
  showAdd?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const isActive = (id: string) =>
    mode === 'single'
      ? activeIds === id
      : (activeIds instanceof Set ? activeIds.has(id) : false);

  const litIds  = ids.filter((id) => isActive(id));
  const dimIds  = ids.filter((id) => !isActive(id));
  const visible = expanded ? ids : litIds;

  return (
    <div className="analyze-chip-group">
      {visible.map((id) => {
        const entry = glossaryById.get(id);
        if (!entry) return null;
        const active = isActive(id);
        const qty = quantities?.get(id) ?? 1;
        const unitLabel = active && quantities ? resolveUnitLabel(id) : undefined;
        return (
          <AnalyzeChip
            key={id}
            label={entry.name_zh}
            active={active}
            onToggle={() => onToggle(id)}
            quantity={quantities && active ? qty : undefined}
            unitLabel={unitLabel}
            onQuantityChange={onQuantityChange ? (n) => onQuantityChange(id, n) : undefined}
          />
        );
      })}
      {!expanded && dimIds.length > 0 && (
        <AddChip onClick={() => setExpanded(true)} label={`+ ${dimIds.length}`} />
      )}
      {expanded && showAdd && (
        <AddChip onClick={() => setExpanded(false)} label="收起" />
      )}
    </div>
  );
}

// ── Effects sub-panel (keeps accordion) ───────────────────────────────────────
function EffectsSection({
  colorEffectIds, artIds, decoIds, quantities,
  onColorEffectToggle, onArtToggle, onDecoToggle, onQuantityChange,
}: {
  colorEffectIds: Set<string>;
  artIds: Set<string>;
  decoIds: Set<string>;
  quantities: Map<string, number>;
  onColorEffectToggle: (id: string) => void;
  onArtToggle: (id: string) => void;
  onDecoToggle: (id: string) => void;
  onQuantityChange: (id: string, n: number) => void;
}) {
  const [openSection, setOpenSection] = useState<'color' | 'art' | 'deco' | null>('color');
  const toggle = (s: 'color' | 'art' | 'deco') => setOpenSection((prev) => (prev === s ? null : s));

  return (
    <div className="analyze-section">
      <h3 className="analyze-section-title">款式效果</h3>

      <div className="manage-accordion">
        <button type="button" className="manage-accordion-header" onClick={() => toggle('color')}>
          <span>颜色效果</span>
          <span className="manage-accordion-chevron">{openSection === 'color' ? '▲' : '▼'}</span>
        </button>
        {openSection === 'color' && (
          <div className="manage-accordion-body">
            <ChipGroup ids={COLOR_EFFECT_IDS} activeIds={colorEffectIds} onToggle={onColorEffectToggle} showAdd />
          </div>
        )}
      </div>

      <div className="manage-accordion">
        <button type="button" className="manage-accordion-header" onClick={() => toggle('art')}>
          <span>艺术效果</span>
          <span className="manage-accordion-chevron">{openSection === 'art' ? '▲' : '▼'}</span>
        </button>
        {openSection === 'art' && (
          <div className="manage-accordion-body">
            {ART_GROUPS.map((group) => (
              <div key={group.label} className="analyze-accordion-subgroup">
                <div className="analyze-accordion-subgroup-label">{group.label}</div>
                <ChipGroup ids={group.ids} activeIds={artIds} onToggle={onArtToggle} showAdd />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="manage-accordion">
        <button type="button" className="manage-accordion-header" onClick={() => toggle('deco')}>
          <span>装饰效果</span>
          <span className="manage-accordion-chevron">{openSection === 'deco' ? '▲' : '▼'}</span>
        </button>
        {openSection === 'deco' && (
          <div className="manage-accordion-body">
            {DECO_GROUPS.map((group) => (
              <div key={group.label} className="analyze-accordion-subgroup">
                <div className="analyze-accordion-subgroup-label">{group.label}</div>
                <ChipGroup
                  ids={group.ids}
                  activeIds={decoIds}
                  onToggle={onDecoToggle}
                  quantities={quantities}
                  onQuantityChange={onQuantityChange}
                  showAdd
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Price table (shown below the chip sections) ───────────────────────────────
const PRICED_SET = new Set(['service_module', 'billable_component']);
const BASE_MANICURE_ID = 'basic_manicure_service';

// Container service modules (颜色与效果服务 / 美术设计服务 …) are grouping parents, not real rows; only the
// base manicure is a genuine service_module line.
function isPricedRow(glossaryType: string, glossaryId: string): boolean {
  if (!PRICED_SET.has(glossaryType)) return false;
  return glossaryType !== 'service_module' || glossaryId === BASE_MANICURE_ID;
}

function PriceTable({ breakdown, currency }: { breakdown: BreakdownResult; currency: string }) {
  const priced = breakdown.items.filter((i) => isPricedRow(i.glossaryType, i.glossaryId));
  if (priced.length === 0) return null;

  return (
    <div className="analyze-section">
      <h3 className="analyze-section-title">单价明细</h3>
      <table className="analyze-total-table">
        <thead>
          <tr>
            <th>项目</th>
            <th className="analyze-total-duration">时长</th>
            <th className="analyze-total-price">金额</th>
          </tr>
        </thead>
        <tbody>
          {priced.map((item) => {
            const qty = item.quantity;
            const isBillable = item.glossaryType === 'billable_component';
            const dur = isBillable ? item.duration * qty : item.duration;
            const price = item.price * qty;
            const unitZh = UNIT_ZH[item.unit] ?? item.unit;
            return (
              <tr key={item.glossaryId}>
                <td>
                  {item.nameZh}
                  {qty > 1 && <span style={{ color: 'var(--color-muted)', marginLeft: '0.2rem' }}>×{qty} {unitZh}</span>}
                </td>
                <td className="analyze-total-duration">{dur > 0 ? `${dur} 分钟` : '—'}</td>
                <td className="analyze-total-price">{price > 0 ? `${price.toFixed(2)} ${currency}` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Public component props (unchanged interface) ──────────────────────────────
type ComponentBreakdownPanelProps = {
  image: SelectedNailImage | null;
  cachedResult?: BreakdownResult | null;
  onResult?: (result: BreakdownResult) => void;
};

// ── Full breakdown export (used by TryOn — read-only, unchanged) ──────────────
export function BreakdownTable({ result }: { result: BreakdownResult }) {
  const priced = result.items.filter((i) => isPricedRow(i.glossaryType, i.glossaryId));
  const totalPrice = priced.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalDuration = priced.reduce((s, i) => {
    return s + (i.glossaryType === 'billable_component' ? i.duration * i.quantity : i.duration);
  }, 0);

  return (
    <div className="breakdown-inline">
      <table className="breakdown-table" aria-label="收费项目明细">
        <tbody>
          {priced.map((item) => {
            const qty = item.quantity;
            const isBillable = item.glossaryType === 'billable_component';
            return (
              <tr key={item.glossaryId}>
                <td>
                  <span className="breakdown-label">{item.nameZh}</span>
                  {qty > 1 && <span className="breakdown-qty"> ×{qty}</span>}
                </td>
                <td className="breakdown-duration">
                  {item.duration > 0 ? `${isBillable ? item.duration * qty : item.duration} min` : '—'}
                </td>
                <td className="breakdown-price">
                  {item.price > 0 ? `$${(item.price * qty).toFixed(2)}` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="breakdown-total">
            <td>总计</td>
            <td className="breakdown-duration">{totalDuration} min</td>
            <td className="breakdown-price">${totalPrice.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function ComponentBreakdownPanel({ image, cachedResult, onResult }: ComponentBreakdownPanelProps) {
  const { language } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');
  const currency = loadCurrency();

  // Selection state
  const [removalId,       setRemovalId]       = useState<string | null>(null);
  const [structureIds,    setStructureIds]     = useState<Set<string>>(new Set(['builder_gel']));
  const [nailShape,       setNailShape]        = useState<string | null>(null);
  const [nailLength,      setNailLength]       = useState<string | null>(null);
  const [texture,         setTexture]          = useState<string | null>(null);
  const [colorIds,        setColorIds]         = useState<Set<string>>(new Set());
  const [colorEffectIds,  setColorEffectIds]   = useState<Set<string>>(new Set());
  const [artIds,          setArtIds]           = useState<Set<string>>(new Set());
  const [decoIds,         setDecoIds]          = useState<Set<string>>(new Set());
  const [quantities,      setQuantities]       = useState<Map<string, number>>(new Map());

  const lastAnalysedRef = useRef<string | null>(
    cachedResult && image ? image.imageBase64.slice(0, 64) : null
  );

  useEffect(() => {
    if (cachedResult) applyBreakdown(cachedResult);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!image) return;
    const imageKey = image.imageBase64.slice(0, 64);
    if (lastAnalysedRef.current === imageKey) return;
    lastAnalysedRef.current = imageKey;
    void runAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  function applyBreakdown(result: BreakdownResult) {
    const s = seedStateFromBreakdown(result);
    setRemovalId(s.removalId);
    setStructureIds(s.structureIds);
    setNailShape(s.nailShape);
    setNailLength(s.nailLength);
    setTexture(s.texture);
    setColorIds(s.colorIds);
    setColorEffectIds(s.colorEffectIds);
    setArtIds(s.artIds);
    setDecoIds(s.decoIds);
    setQuantities(s.quantities);
  }

  async function runAnalysis() {
    if (!image) return;
    setIsLoading(true);
    setError('');
    try {
      const merchantSettings = loadGlossarySettings();
      const response = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image.imageBase64,
          language,
          mimeType: image.mimeType,
          merchantSettings,
        }),
      });
      const body = (await response.json()) as BreakdownResult & { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? (language === 'zh-CN' ? '分析失败。' : 'Breakdown failed.'));
      }
      applyBreakdown(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : language === 'zh-CN' ? '分析失败。' : 'Breakdown failed.');
    } finally {
      setIsLoading(false);
    }
  }

  const breakdown = useMemo(
    () => buildBreakdownResult(
      removalId, structureIds, nailShape, nailLength, texture,
      colorIds, colorEffectIds, artIds, decoIds, quantities
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [removalId, structureIds, nailShape, nailLength, texture,
     colorIds, colorEffectIds, artIds, decoIds, quantities]
  );

  useEffect(() => { onResult?.(breakdown); }, [breakdown]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSet(setter: Dispatch<SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSingle(current: string | null, setter: Dispatch<SetStateAction<string | null>>, id: string) {
    setter(current === id ? null : id);
  }

  function handleQuantityChange(id: string, n: number) {
    setQuantities((prev) => { const next = new Map(prev); next.set(id, Math.max(1, n)); return next; });
  }

  if (isLoading) {
    return (
      <LoadingState
        title={language === 'zh-CN' ? 'AI 识别中' : 'AI analysis in progress'}
        body={language === 'zh-CN' ? '正在从图片识别甲型与款式…' : 'Detecting nail shape and style from the image…'}
      />
    );
  }

  if (error) {
    return (
      <section className="summary-card" role="alert">
        <strong>{language === 'zh-CN' ? '分析失败' : 'Analysis failed'}</strong>
        <p>{error}</p>
        <Button size="compact" variant="secondary" onClick={() => { lastAnalysedRef.current = null; void runAnalysis(); }}>
          {language === 'zh-CN' ? '重试' : 'Retry'}
        </Button>
      </section>
    );
  }

  return (
    <div className="analyze-flat-layout">
      {/* ── Summary bar ── */}
      <BreakdownSummary breakdown={breakdown} currency={currency} />

      {/* ── 卸甲 (single-select) ── */}
      <div className="analyze-section">
        <h3 className="analyze-section-title">卸甲</h3>
        <div className="analyze-chip-group">
          {REMOVAL_IDS.map((id) => {
            const entry = glossaryById.get(id);
            if (!entry) return null;
            return (
              <AnalyzeChip
                key={id}
                label={entry.name_zh}
                active={removalId === id}
                onToggle={() => toggleSingle(removalId, setRemovalId, id)}
              />
            );
          })}
        </div>
      </div>

      {/* ── 建构/延长 ── */}
      <div className="analyze-section">
        <h3 className="analyze-section-title">建构 / 延长</h3>
        <div className="analyze-chip-group">
          {STRUCTURE_IDS.map((id) => {
            const entry = glossaryById.get(id);
            if (!entry) return null;
            return (
              <AnalyzeChip
                key={id}
                label={entry.name_zh}
                active={structureIds.has(id)}
                onToggle={() => toggleSet(setStructureIds, id)}
              />
            );
          })}
        </div>
      </div>

      {/* ── 甲型/颜色 ── */}
      <div className="analyze-section">
        <h3 className="analyze-section-title">甲型 / 颜色</h3>
        <div className="analyze-subrow">
          <div className="analyze-subrow-label">甲型</div>
          <ChipGroup ids={SHAPE_IDS} activeIds={nailShape} mode="single" onToggle={(id) => toggleSingle(nailShape, setNailShape, id)} showAdd />
        </div>
        <div className="analyze-subrow">
          <div className="analyze-subrow-label">甲长</div>
          <ChipGroup ids={LENGTH_IDS} activeIds={nailLength} mode="single" onToggle={(id) => toggleSingle(nailLength, setNailLength, id)} showAdd />
        </div>
        <div className="analyze-subrow">
          <div className="analyze-subrow-label">质感</div>
          <ChipGroup ids={TEXTURE_IDS} activeIds={texture} mode="single" onToggle={(id) => toggleSingle(texture, setTexture, id)} showAdd />
        </div>
        <div className="analyze-subrow">
          <div className="analyze-subrow-label">底色（可多选）</div>
          <ChipGroup ids={COLOR_IDS} activeIds={colorIds} onToggle={(id) => toggleSet(setColorIds, id)} showAdd />
        </div>
      </div>

      {/* ── 款式效果 (accordion) ── */}
      <EffectsSection
        colorEffectIds={colorEffectIds}
        artIds={artIds}
        decoIds={decoIds}
        quantities={quantities}
        onColorEffectToggle={(id) => toggleSet(setColorEffectIds, id)}
        onArtToggle={(id) => toggleSet(setArtIds, id)}
        onDecoToggle={(id) => toggleSet(setDecoIds, id)}
        onQuantityChange={handleQuantityChange}
      />

      {/* ── Price table ── */}
      <PriceTable breakdown={breakdown} currency={currency} />

      {/* ── Re-analyse ── */}
      <div style={{ padding: '0.75rem 0' }}>
        <Button block size="compact" variant="secondary" disabled={isLoading} onClick={() => { lastAnalysedRef.current = null; void runAnalysis(); }}>
          重新分析
        </Button>
      </div>
    </div>
  );
}
