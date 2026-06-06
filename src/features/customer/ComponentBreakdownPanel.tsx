'use client';

import { useEffect, useRef, useState } from 'react';
import type { BreakdownResult, GlossaryBreakdownItem } from '@/domain/nail';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { loadGlossarySettings } from '@/data/glossary-settings-store';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';

type ComponentBreakdownPanelProps = {
  image: SelectedNailImage | null;
  onResult?: (result: BreakdownResult) => void;
};

// ── Badge colour by glossaryType ──────────────────────────────────────────────
const TYPE_BADGE_CLASS: Record<string, string> = {
  service_module:     'breakdown-category-base',
  billable_component: 'breakdown-category-color_style',
  procedure:          'breakdown-category-other',
  visual_attribute:   'breakdown-category-shape',
  complexity_level:   'breakdown-category-addon',
  style_tag:          'breakdown-category-addon',
};

function badgeClass(glossaryType: string): string {
  return TYPE_BADGE_CLASS[glossaryType] ?? 'breakdown-category-other';
}

const UNIT_ZH: Record<string, string> = {
  set:    '套',
  finger: '指',
  piece:  '颗',
};

// ── Quantity stepper ──────────────────────────────────────────────────────────
function QuantityStepper({
  value,
  unit,
  onChange,
}: {
  value: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  const unitZh = UNIT_ZH[unit] ?? unit;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.4rem' }}>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => {
          const n = Math.max(1, Math.round(Number(e.target.value) || 1));
          onChange(n);
        }}
        aria-label="数量"
        style={{
          width: '2.6rem', textAlign: 'center', fontSize: 'var(--text-sm)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-surface-strong)', padding: '0.1rem 0.2rem',
          color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums',
        }}
      />
      {unitZh && (
        <span className="breakdown-qty">{unitZh}</span>
      )}
    </span>
  );
}

// ── Priced table ──────────────────────────────────────────────────────────────
const PRICED_TYPES = new Set(['service_module', 'billable_component']);

type PricedTableProps = {
  items: GlossaryBreakdownItem[];
  quantities: Map<string, number>;
  onQuantityChange?: (glossaryId: string, qty: number) => void;
};

function PricedTable({ items, quantities, onQuantityChange }: PricedTableProps) {
  const priced = items.filter((i) => PRICED_TYPES.has(i.glossaryType));
  if (priced.length === 0) return null;

  const totalPrice = priced.reduce((s, i) => {
    const qty = quantities.get(i.glossaryId) ?? i.quantity;
    return s + i.price * qty;
  }, 0);
  const totalDuration = priced.reduce((s, i) => {
    const qty = quantities.get(i.glossaryId) ?? i.quantity;
    // duration scales with quantity only for billable_component
    return s + (i.glossaryType === 'billable_component' ? i.duration * qty : i.duration);
  }, 0);

  return (
    <table className="breakdown-table" aria-label="收费项目明细">
      <tbody>
        {priced.map((item) => {
          const qty = quantities.get(item.glossaryId) ?? item.quantity;
          const isBillable = item.glossaryType === 'billable_component';
          return (
            <tr key={item.glossaryId}>
              <td>
                <span className={`breakdown-category-badge ${badgeClass(item.glossaryType)}`}>
                  {item.typeZh}
                </span>
                <span className="breakdown-label">{item.nameZh}</span>
                {isBillable && onQuantityChange ? (
                  <QuantityStepper
                    value={qty}
                    unit={item.unit}
                    onChange={(n) => onQuantityChange(item.glossaryId, n)}
                  />
                ) : (
                  qty > 1 && (
                    <span className="breakdown-qty"> ×{qty} {item.unit}</span>
                  )
                )}
              </td>
              <td className="breakdown-duration">
                {item.duration > 0
                  ? `${isBillable ? item.duration * qty : item.duration} min`
                  : '—'}
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
  );
}

// ── Label summary paragraph ───────────────────────────────────────────────────
const LABEL_TYPES = new Set(['visual_attribute', 'complexity_level', 'style_tag']);

const TYPE_ZH_LABEL: Record<string, string> = {
  visual_attribute: '视觉效果',
  complexity_level: '复杂度',
  style_tag:        '风格',
};

function LabelSummary({ items }: { items: GlossaryBreakdownItem[] }) {
  const labels = items.filter((i) => LABEL_TYPES.has(i.glossaryType));
  if (labels.length === 0) return null;

  const groups = new Map<string, string[]>();
  for (const item of labels) {
    const existing = groups.get(item.glossaryType);
    if (existing) {
      existing.push(item.nameZh);
    } else {
      groups.set(item.glossaryType, [item.nameZh]);
    }
  }

  const lines = Array.from(groups.entries()).map(
    ([type, names]) => `${TYPE_ZH_LABEL[type] ?? type}：${names.join('、')}。`
  );

  return (
    <div style={{
      padding: '0.75rem 0.9rem',
      background: 'rgba(236, 93, 123, 0.05)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
    }}>
      {lines.map((line) => (
        <p key={line} style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-muted)', lineHeight: 1.6 }}>
          {line}
        </p>
      ))}
    </div>
  );
}

// ── Full breakdown export (used by TryOn) ─────────────────────────────────────
export function BreakdownTable({ result }: { result: BreakdownResult }) {
  const quantities = new Map(result.items.map((i) => [i.glossaryId, i.quantity]));
  return (
    <div className="breakdown-inline">
      <PricedTable items={result.items} quantities={quantities} />
      <LabelSummary items={result.items} />
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function ComponentBreakdownPanel({ image, onResult }: ComponentBreakdownPanelProps) {
  const [result, setResult] = useState<BreakdownResult | null>(null);
  const [quantities, setQuantities] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const lastAnalysedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!image) return;
    const imageKey = image.imageBase64.slice(0, 64);
    if (lastAnalysedRef.current === imageKey) return;
    lastAnalysedRef.current = imageKey;
    void runAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  async function runAnalysis() {
    if (!image) return;
    setIsLoading(true);
    setError('');
    setResult(null);
    setQuantities(new Map());

    try {
      const merchantSettings = loadGlossarySettings();
      const response = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: image.imageBase64, mimeType: image.mimeType, merchantSettings }),
      });

      const body = (await response.json()) as BreakdownResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Breakdown failed.');

      setResult(body);
      setQuantities(new Map(body.items.map((i) => [i.glossaryId, i.quantity])));
      onResult?.(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Breakdown failed.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleQuantityChange(glossaryId: string, qty: number) {
    if (!result) return;
    const next = new Map(quantities);
    next.set(glossaryId, qty);
    setQuantities(next);

    // Recompute totals and notify parent
    const updatedItems = result.items.map((i) => ({
      ...i,
      quantity: next.get(i.glossaryId) ?? i.quantity,
    }));
    const totalPrice = updatedItems
      .filter((i) => PRICED_TYPES.has(i.glossaryType))
      .reduce((s, i) => s + i.price * i.quantity, 0);
    const totalDuration = updatedItems
      .filter((i) => PRICED_TYPES.has(i.glossaryType))
      .reduce((s, i) => s + (i.glossaryType === 'billable_component' ? i.duration * i.quantity : i.duration), 0);

    onResult?.({ ...result, items: updatedItems, totalPrice, totalDuration });
  }

  function handleReAnalyse() {
    lastAnalysedRef.current = null;
    void runAnalysis();
  }

  if (isLoading) {
    return <LoadingState title="Analysing nail components" body="Identifying services from the glossary…" />;
  }

  if (error) {
    return (
      <section className="summary-card" role="alert">
        <strong>分析失败</strong>
        <p>{error}</p>
        <Button size="compact" variant="secondary" onClick={handleReAnalyse}>重试</Button>
      </section>
    );
  }

  if (!result) return null;

  return (
    <div className="breakdown-inline">
      <PricedTable items={result.items} quantities={quantities} onQuantityChange={handleQuantityChange} />
      <LabelSummary items={result.items} />
      <Button block size="compact" variant="secondary" disabled={isLoading} onClick={handleReAnalyse}>
        重新分析
      </Button>
    </div>
  );
}
