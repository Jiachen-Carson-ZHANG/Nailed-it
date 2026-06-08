'use client';

import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import type { BreakdownResult, GlossaryBreakdownItem } from '@/domain/nail';
import type { CatalogSelection } from '@/domain/catalog';
import { BASE_MANICURE_CATALOG_ID, withBaseManicure } from '@/domain/style-selections';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { glossaryById, glossaryEntries } from '@/data/glossary';
import {
  getDefaultSettings,
  type GlossaryEntrySettings,
} from '@/data/glossary-settings-store';
import { useMerchantPricingSettings } from '@/features/merchant/useMerchantPricingSettings';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { AnalyzeChip, AddChip } from '@/features/merchant/AnalyzeChip';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import { formatCurrency } from '@/i18n/format';
import {
  breakdownPanelCopy,
  COLOR_EFFECT_IDS,
  entryDisplayName,
  resolveUnitLabel,
  type BreakdownPanelCopy,
} from '@/features/customer/breakdown-panel-copy';

// ── Glossary lookup helpers ───────────────────────────────────────────────────
const byCategory = (cat: string) =>
  glossaryEntries.filter((e) => e.category === cat);

const REMOVAL_IDS   = ['removal_basic_gel', 'removal_short_extension', 'removal_extension', 'removal_with_rhinestone'];
const STRUCTURE_IDS = ['builder_gel', 'nail_tip_full_cover', 'nail_tip_half_cover', 'nail_tip_shallow_cover'];
const SHAPE_IDS     = byCategory('nail_shape').map((e) => e.id);
const LENGTH_IDS    = byCategory('nail_length').map((e) => e.id);
const TEXTURE_IDS   = byCategory('texture').map((e) => e.id);
const COLOR_IDS     = byCategory('color').map((e) => e.id);

/** @internal Exported for regression tests — round-trip stored config → chip state → totals. */
export function seedStateFromBreakdown(result: BreakdownResult) {
  const structureIds = new Set<string>();
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
      if (item.quantity > 0) quantities.set(item.glossaryId, item.quantity);
    } else if (cat === 'decoration') {
      decoIds.add(item.glossaryId);
      if (item.quantity > 0) quantities.set(item.glossaryId, item.quantity);
    }
  }

  return { removalId, structureIds, nailShape, nailLength, texture, colorIds, colorEffectIds, artIds, decoIds, quantities };
}

// ── Shared item builder (glossary id → priced breakdown row) ──────────────────
type GlossarySettingMap = Map<string, GlossaryEntrySettings>;

function itemFromId(id: string, qty: number, settingsById: GlossarySettingMap): GlossaryBreakdownItem | null {
  const entry = glossaryById.get(id);
  if (!entry) return null;
  const s = settingsById.get(id);
  const parentEntry = entry.parent_id !== 'na' ? glossaryById.get(entry.parent_id) : undefined;
  const unit = s?.unit ?? entry.default_pricing_unit;
  return {
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
  };
}

function pricedTotals(items: GlossaryBreakdownItem[]): { totalPrice: number; totalDuration: number } {
  const PRICED = new Set(['service_module', 'billable_component']);
  const priced = items.filter((i) => PRICED.has(i.glossaryType));
  return {
    totalPrice: priced.reduce((sum, i) => sum + i.price * i.quantity, 0),
    totalDuration: priced.reduce(
      (sum, i) => sum + (i.glossaryType === 'billable_component' ? i.duration * i.quantity : i.duration),
      0,
    ),
  };
}

// ── Rebuild BreakdownResult from current selections ───────────────────────────
function catalogSelectionsFromChipState(
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
): CatalogSelection[] {
  const selections: CatalogSelection[] = [];
  if (removalId) selections.push({ catalogItemId: removalId, quantity: 1 });
  for (const id of structureIds) selections.push({ catalogItemId: id, quantity: 1 });
  if (nailShape) selections.push({ catalogItemId: nailShape, quantity: 1 });
  if (nailLength) selections.push({ catalogItemId: nailLength, quantity: 1 });
  if (texture) selections.push({ catalogItemId: texture, quantity: 1 });
  for (const id of colorIds) selections.push({ catalogItemId: id, quantity: 1 });
  for (const id of colorEffectIds) selections.push({ catalogItemId: id, quantity: 1 });
  for (const id of artIds) selections.push({ catalogItemId: id, quantity: quantities.get(id) ?? 1 });
  for (const id of decoIds) selections.push({ catalogItemId: id, quantity: quantities.get(id) ?? 1 });
  return withBaseManicure(selections);
}

/** @internal Exported for regression tests — round-trip stored config → chip state → totals. */
export function buildBreakdownResult(
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
  settingsById: GlossarySettingMap,
): BreakdownResult {
  const catalogSelections = catalogSelectionsFromChipState(
    removalId,
    structureIds,
    nailShape,
    nailLength,
    texture,
    colorIds,
    colorEffectIds,
    artIds,
    decoIds,
    quantities,
  );

  const items = catalogSelections.flatMap((sel) => {
    const item = itemFromId(sel.catalogItemId, sel.quantity, settingsById);
    return item ? [item] : [];
  });

  const { totalPrice, totalDuration } = pricedTotals(items);
  return { items, catalogSelections, totalPrice, totalDuration, mode: 'glossary' };
}

// Seed the panel from already-stored catalog selections (merchant re-edit). glossary ids === catalog
// ids in this codebase, so each selection resolves through glossaryById.
export function buildBreakdownFromSelections(
  selections: CatalogSelection[],
  settings?: GlossaryEntrySettings[],
): BreakdownResult {
  const catalogSelections = withBaseManicure(selections);
  const settingsById: GlossarySettingMap = new Map(
    (settings ?? getDefaultSettings()).map((s) => [s.id, s]),
  );
  const items = catalogSelections.flatMap((sel) => {
    const item = itemFromId(sel.catalogItemId, sel.quantity, settingsById);
    return item ? [item] : [];
  });
  const { totalPrice, totalDuration } = pricedTotals(items);
  return { items, catalogSelections, totalPrice, totalDuration, mode: 'glossary' };
}

const glossaryByName = new Map(glossaryEntries.map((entry) => [entry.name_zh, entry.id]));

// Seed from a stored style config: the priced selections (catalogBreakdown) PLUS the descriptive
// facets (colour / shape / length / finish / style) the merchant pipeline stores as facets rather than
// priced selections. Without this, a re-edited or published style shows no colour/shape selected even
// though it has them. Facet labels are catalog names, so they resolve to ids via glossaryByName.
export function buildBreakdownFromConfig(
  selections: CatalogSelection[],
  facetLabels: string[],
  settings?: GlossaryEntrySettings[],
): BreakdownResult {
  const ids = new Set(selections.map((s) => s.catalogItemId));
  const merged = [...selections];
  for (const label of facetLabels) {
    const id = glossaryByName.get(label);
    if (id && !ids.has(id)) {
      merged.push({ catalogItemId: id, quantity: 1 });
      ids.add(id);
    }
  }
  return buildBreakdownFromSelections(merged, settings);
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function BreakdownSummary({
  breakdown,
  copy,
}: {
  breakdown: BreakdownResult;
  copy: BreakdownPanelCopy;
}) {
  const priceStr = breakdown.totalPrice > 0
    ? formatCurrency({ cents: Math.round(breakdown.totalPrice * 100) })
    : copy.noValue;
  const durationStr = breakdown.totalDuration > 0
    ? copy.minutes(breakdown.totalDuration)
    : copy.noValue;

  return (
    <div className="analyze-summary-bar">
      <div className="analyze-summary-item">
        <span className="analyze-summary-label">{copy.summaryTotalPrice}</span>
        <span className="analyze-summary-value" key={priceStr}>{priceStr}</span>
      </div>
      <div className="analyze-summary-divider" />
      <div className="analyze-summary-item">
        <span className="analyze-summary-label">{copy.summaryTotalDuration}</span>
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
  language,
  copy,
}: {
  ids: string[];
  activeIds: Set<string> | string | null;
  mode?: 'single' | 'multi';
  onToggle: (id: string) => void;
  quantities?: Map<string, number>;
  onQuantityChange?: (id: string, n: number) => void;
  showAdd?: boolean;
  language: AppLanguage;
  copy: BreakdownPanelCopy;
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
        const unitLabel = active && quantities ? resolveUnitLabel(id, language) : undefined;
        return (
          <AnalyzeChip
            key={id}
            label={entryDisplayName(id, language)}
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
        <AddChip onClick={() => setExpanded(false)} label={copy.collapse} />
      )}
    </div>
  );
}

// ── Effects sub-panel (keeps accordion) ───────────────────────────────────────
function EffectsSection({
  colorEffectIds, artIds, decoIds, quantities,
  onColorEffectToggle, onArtToggle, onDecoToggle, onQuantityChange,
  language,
  copy,
}: {
  colorEffectIds: Set<string>;
  artIds: Set<string>;
  decoIds: Set<string>;
  quantities: Map<string, number>;
  onColorEffectToggle: (id: string) => void;
  onArtToggle: (id: string) => void;
  onDecoToggle: (id: string) => void;
  onQuantityChange: (id: string, n: number) => void;
  language: AppLanguage;
  copy: BreakdownPanelCopy;
}) {
  const [openSection, setOpenSection] = useState<'color' | 'art' | 'deco' | null>('color');
  const toggle = (s: 'color' | 'art' | 'deco') => setOpenSection((prev) => (prev === s ? null : s));

  return (
    <div className="analyze-section">
      <h3 className="analyze-section-title">{copy.effectsTitle}</h3>

      <div className="manage-accordion">
        <button type="button" className="manage-accordion-header" onClick={() => toggle('color')}>
          <span>{copy.colorEffects}</span>
          <span className="manage-accordion-chevron">{openSection === 'color' ? '▲' : '▼'}</span>
        </button>
        {openSection === 'color' && (
          <div className="manage-accordion-body">
            <ChipGroup ids={[...COLOR_EFFECT_IDS]} activeIds={colorEffectIds} onToggle={onColorEffectToggle} showAdd language={language} copy={copy} />
          </div>
        )}
      </div>

      <div className="manage-accordion">
        <button type="button" className="manage-accordion-header" onClick={() => toggle('art')}>
          <span>{copy.artEffects}</span>
          <span className="manage-accordion-chevron">{openSection === 'art' ? '▲' : '▼'}</span>
        </button>
        {openSection === 'art' && (
          <div className="manage-accordion-body">
            {copy.artGroups.map((group) => (
              <div key={group.label} className="analyze-accordion-subgroup">
                <div className="analyze-accordion-subgroup-label">{group.label}</div>
                <ChipGroup
                  ids={group.ids}
                  activeIds={artIds}
                  onToggle={onArtToggle}
                  quantities={quantities}
                  onQuantityChange={onQuantityChange}
                  showAdd
                  language={language}
                  copy={copy}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="manage-accordion">
        <button type="button" className="manage-accordion-header" onClick={() => toggle('deco')}>
          <span>{copy.decoEffects}</span>
          <span className="manage-accordion-chevron">{openSection === 'deco' ? '▲' : '▼'}</span>
        </button>
        {openSection === 'deco' && (
          <div className="manage-accordion-body">
            {copy.decoGroups.map((group) => (
              <div key={group.label} className="analyze-accordion-subgroup">
                <div className="analyze-accordion-subgroup-label">{group.label}</div>
                <ChipGroup
                  ids={group.ids}
                  activeIds={decoIds}
                  onToggle={onDecoToggle}
                  quantities={quantities}
                  onQuantityChange={onQuantityChange}
                  showAdd
                  language={language}
                  copy={copy}
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
const BASE_MANICURE_ID = BASE_MANICURE_CATALOG_ID;

// Container service modules (颜色与效果服务 / 美术设计服务 …) are grouping parents, not real rows; only the
// base manicure is a genuine service_module line.
function isPricedRow(glossaryType: string, glossaryId: string): boolean {
  if (!PRICED_SET.has(glossaryType)) return false;
  return glossaryType !== 'service_module' || glossaryId === BASE_MANICURE_ID;
}

function PriceTable({
  breakdown,
  language,
  copy,
}: {
  breakdown: BreakdownResult;
  language: AppLanguage;
  copy: BreakdownPanelCopy;
}) {
  const priced = breakdown.items.filter((i) => isPricedRow(i.glossaryType, i.glossaryId));
  if (priced.length === 0) return null;

  return (
    <div className="analyze-section">
      <h3 className="analyze-section-title">{copy.priceDetail}</h3>
      <table className="analyze-total-table">
        <thead>
          <tr>
            <th>{copy.colItem}</th>
            <th className="analyze-total-duration">{copy.colDuration}</th>
            <th className="analyze-total-price">{copy.colAmount}</th>
          </tr>
        </thead>
        <tbody>
          {priced.map((item) => {
            const qty = item.quantity;
            const isBillable = item.glossaryType === 'billable_component';
            const dur = isBillable ? item.duration * qty : item.duration;
            const price = item.price * qty;
            const unitLabel = copy.units[item.unit as keyof typeof copy.units] ?? item.unit;
            const displayName = entryDisplayName(item.glossaryId, language);
            return (
              <tr key={item.glossaryId}>
                <td>
                  {displayName}
                  {qty > 1 && <span style={{ color: 'var(--color-muted)', marginLeft: '0.2rem' }}>×{qty} {unitLabel}</span>}
                </td>
                <td className="analyze-total-duration">{dur > 0 ? copy.minutes(dur) : copy.noValue}</td>
                <td className="analyze-total-price">{price > 0 ? formatCurrency({ cents: Math.round(price * 100) }) : copy.noValue}</td>
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
  /** Display-only fallback, used when saved merchant styles render before original bytes finish loading. */
  previewUrl?: string;
  cachedResult?: BreakdownResult | null;
  onResult?: (result: BreakdownResult) => void;
  onSuggestedStyleName?: (suggestion: NonNullable<BreakdownResult['suggestedStyleName']>) => void;
  // Merchant editing reuses this panel but never picks 卸甲 (removal is a customer-booking concern).
  showRemoval?: boolean;
  // Extra actions rendered under 重新分析 (merchant: Save / Publish). Customer leaves it empty.
  footer?: ReactNode;
  // When false, a (possibly late-loaded) image is kept only for 重新分析 and never auto-analyzed —
  // used by the merchant re-edit, which seeds from cachedResult and must not overwrite it.
  autoAnalyze?: boolean;
};

// ── Full breakdown export (used by TryOn — read-only, unchanged) ──────────────
export function BreakdownTable({ result }: { result: BreakdownResult }) {
  const { language } = useLanguage();
  const copy = breakdownPanelCopy[language];
  const priced = result.items.filter((i) => isPricedRow(i.glossaryType, i.glossaryId));
  const totalPrice = priced.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalDuration = priced.reduce((s, i) => {
    return s + (i.glossaryType === 'billable_component' ? i.duration * i.quantity : i.duration);
  }, 0);

  return (
    <div className="breakdown-inline">
      <table className="breakdown-table" aria-label={copy.tableAria}>
        <tbody>
          {priced.map((item) => {
            const qty = item.quantity;
            const isBillable = item.glossaryType === 'billable_component';
            const displayName = entryDisplayName(item.glossaryId, language);
            return (
              <tr key={item.glossaryId}>
                <td>
                  <span className="breakdown-label">{displayName}</span>
                  {qty > 1 && <span className="breakdown-qty"> ×{qty}</span>}
                </td>
                <td className="breakdown-duration">
                  {item.duration > 0 ? copy.minutes(isBillable ? item.duration * qty : item.duration) : copy.noValue}
                </td>
                <td className="breakdown-price">
                  {item.price > 0 ? formatCurrency({ cents: Math.round(item.price * qty * 100) }) : copy.noValue}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="breakdown-total">
            <td>{copy.total}</td>
            <td className="breakdown-duration">{copy.minutes(totalDuration)}</td>
            <td className="breakdown-price">{formatCurrency({ cents: Math.round(totalPrice * 100) })}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function ComponentBreakdownPanel({
  image,
  previewUrl,
  cachedResult,
  onResult,
  onSuggestedStyleName,
  showRemoval = true,
  footer,
  autoAnalyze = true,
}: ComponentBreakdownPanelProps) {
  const { language, t } = useLanguage();
  const copy = breakdownPanelCopy[language];
  const { settings, settingsById } = useMerchantPricingSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');
  const [hasResolvedAnalysis, setHasResolvedAnalysis] = useState(Boolean(cachedResult));

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
    if (cachedResult) {
      applyBreakdown(cachedResult);
      setHasResolvedAnalysis(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!image) return;
    const imageKey = image.imageBase64.slice(0, 64);
    if (lastAnalysedRef.current === imageKey) return;
    // Merchant re-edit (autoAnalyze=false): keep the image for 重新分析 but don't overwrite the seeded
    // config when it arrives in the background.
    if (!autoAnalyze) {
      lastAnalysedRef.current = imageKey;
      return;
    }
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
      const merchantSettings = settings;
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
        throw new Error(body.error ?? copy.breakdownFailed);
      }
      if (body.suggestedStyleName) {
        onSuggestedStyleName?.(body.suggestedStyleName);
      }
      applyBreakdown(body);
      setHasResolvedAnalysis(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.breakdownFailed);
    } finally {
      setIsLoading(false);
    }
  }

  const breakdown = useMemo(
    () => buildBreakdownResult(
      removalId, structureIds, nailShape, nailLength, texture,
      colorIds, colorEffectIds, artIds, decoIds, quantities,
      settingsById,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [removalId, structureIds, nailShape, nailLength, texture,
     colorIds, colorEffectIds, artIds, decoIds, quantities, settingsById]
  );

  useEffect(() => {
    if (!hasResolvedAnalysis) return;
    onResult?.(breakdown);
  }, [breakdown, hasResolvedAnalysis, onResult]);

  const displayPreviewUrl = image?.previewUrl ?? previewUrl;

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
        title={copy.loadingTitle}
        body={copy.loadingBody}
      />
    );
  }

  if (error) {
    return (
      <section className="summary-card" role="alert">
        <strong>{copy.errorTitle}</strong>
        <p>{error}</p>
        <Button size="compact" variant="secondary" onClick={() => { lastAnalysedRef.current = null; void runAnalysis(); }}>
          {t('common.retry')}
        </Button>
      </section>
    );
  }

  return (
    <div className="analyze-flat-layout">
      {displayPreviewUrl ? (
        <div className="analyze-image-preview">
          <img alt={copy.imageAlt} src={displayPreviewUrl} />
        </div>
      ) : null}

      {/* ── Summary bar ── */}
      <BreakdownSummary breakdown={breakdown} copy={copy} />

      {/* ── 卸甲 (single-select) — hidden for merchant editing ── */}
      {showRemoval && (
        <div className="analyze-section">
          <h3 className="analyze-section-title">{copy.removal}</h3>
          <div className="analyze-chip-group">
            {REMOVAL_IDS.map((id) => {
              const entry = glossaryById.get(id);
              if (!entry) return null;
              return (
                <AnalyzeChip
                  key={id}
                  label={entryDisplayName(id, language)}
                  active={removalId === id}
                  onToggle={() => toggleSingle(removalId, setRemovalId, id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── 建构/延长 ── */}
      <div className="analyze-section">
        <h3 className="analyze-section-title">{copy.structure}</h3>
        <div className="analyze-chip-group">
          {STRUCTURE_IDS.map((id) => {
            const entry = glossaryById.get(id);
            if (!entry) return null;
            return (
              <AnalyzeChip
                key={id}
                label={entryDisplayName(id, language)}
                active={structureIds.has(id)}
                onToggle={() => toggleSet(setStructureIds, id)}
              />
            );
          })}
        </div>
      </div>

      {/* ── 甲型/颜色 ── */}
      <div className="analyze-section">
        <h3 className="analyze-section-title">{copy.shapeColor}</h3>
        <div className="analyze-subrow">
          <div className="analyze-subrow-label">{copy.nailShape}</div>
          <ChipGroup ids={SHAPE_IDS} activeIds={nailShape} mode="single" onToggle={(id) => toggleSingle(nailShape, setNailShape, id)} showAdd language={language} copy={copy} />
        </div>
        <div className="analyze-subrow">
          <div className="analyze-subrow-label">{copy.nailLength}</div>
          <ChipGroup ids={LENGTH_IDS} activeIds={nailLength} mode="single" onToggle={(id) => toggleSingle(nailLength, setNailLength, id)} showAdd language={language} copy={copy} />
        </div>
        <div className="analyze-subrow">
          <div className="analyze-subrow-label">{copy.texture}</div>
          <ChipGroup ids={TEXTURE_IDS} activeIds={texture} mode="single" onToggle={(id) => toggleSingle(texture, setTexture, id)} showAdd language={language} copy={copy} />
        </div>
        <div className="analyze-subrow">
          <div className="analyze-subrow-label">{copy.baseColor}</div>
          <ChipGroup ids={COLOR_IDS} activeIds={colorIds} onToggle={(id) => toggleSet(setColorIds, id)} showAdd language={language} copy={copy} />
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
        language={language}
        copy={copy}
      />

      {/* ── Price table ── */}
      <PriceTable breakdown={breakdown} language={language} copy={copy} />

      {/* ── Re-analyse ── */}
      <div style={{ padding: '0.75rem 0' }}>
        <Button block size="compact" variant="secondary" disabled={isLoading} onClick={() => { lastAnalysedRef.current = null; void runAnalysis(); }}>
          {copy.reanalyze}
        </Button>
      </div>

      {/* ── Extra actions (merchant: Save / Publish) ── */}
      {footer}
    </div>
  );
}
