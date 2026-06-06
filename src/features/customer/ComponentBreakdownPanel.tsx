'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import type { BreakdownResult, GlossaryBreakdownItem } from '@/domain/nail';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/LoadingState';
import { quoteCatalogSelectionsAction } from '@/lib/actions/booking-actions';
import { catalogItems } from '@/mock/catalog';
import { durationAggregatingPackageIds } from '@/domain/catalog';

function timeOnlyChildren(parentId: string): { nameZh: string; duration: number }[] {
  if (!durationAggregatingPackageIds.has(parentId)) return [];
  return catalogItems
    .filter((item) => item.parentId === parentId && item.billable === 'no')
    .map((item) => ({ nameZh: item.nameZh, duration: item.defaultDurationMin ?? 0 }));
}

type ComponentBreakdownPanelProps = {
  image: SelectedNailImage | null;
  cachedResult?: BreakdownResult | null;
  onResult?: (result: BreakdownResult) => void;
};

const TYPE_BADGE_CLASS: Record<string, string> = {
  service_module: 'breakdown-category-base',
  billable_component: 'breakdown-category-color_style',
  procedure: 'breakdown-category-other',
  visual_attribute: 'breakdown-category-shape',
  complexity_level: 'breakdown-category-addon',
  style_tag: 'breakdown-category-addon',
};

function badgeClass(glossaryType: string): string {
  return TYPE_BADGE_CLASS[glossaryType] ?? 'breakdown-category-other';
}

const UNIT_ZH: Record<string, string> = {
  set: '套',
  finger: '指',
  piece: '颗',
};

function QuantityStepper({
  value,
  unit,
  onChange,
}: {
  value: number;
  unit: string;
  onChange: (quantity: number) => void;
}) {
  const unitZh = UNIT_ZH[unit] ?? unit;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.4rem' }}>
      <input
        aria-label="数量"
        min={1}
        style={{
          width: '2.6rem',
          textAlign: 'center',
          fontSize: 'var(--text-sm)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-surface-strong)',
          padding: '0.1rem 0.2rem',
          color: 'var(--color-text)',
          fontVariantNumeric: 'tabular-nums',
        }}
        type="number"
        value={value}
        onChange={(event) => onChange(Math.max(1, Math.round(Number(event.target.value) || 1)))}
      />
      {unitZh ? <span className="breakdown-qty">{unitZh}</span> : null}
    </span>
  );
}

const PRICED_TYPES = new Set(['service_module', 'billable_component']);

type PricedTableProps = {
  items: GlossaryBreakdownItem[];
  quantities: Map<string, number>;
  totalDuration?: number;
  totalPrice?: number;
  onQuantityChange?: (glossaryId: string, quantity: number) => void;
};

function PricedTable({ items, quantities, totalDuration, totalPrice, onQuantityChange }: PricedTableProps) {
  const priced = items.filter((item) => PRICED_TYPES.has(item.glossaryType));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  if (priced.length === 0) return null;

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const calculatedPrice = priced.reduce((sum, item) => {
    const quantity = quantities.get(item.glossaryId) ?? item.quantity;
    return sum + item.price * quantity;
  }, 0);
  const calculatedDuration = priced.reduce((sum, item) => {
    const quantity = quantities.get(item.glossaryId) ?? item.quantity;
    return sum + (item.glossaryType === 'billable_component' ? item.duration * quantity : item.duration);
  }, 0);

  return (
    <table className="breakdown-table" aria-label="收费项目明细">
      <tbody>
        {priced.map((item) => {
          const quantity = quantities.get(item.glossaryId) ?? item.quantity;
          const isBillable = item.glossaryType === 'billable_component';
          const steps = timeOnlyChildren(item.glossaryId);
          const isOpen = expanded.has(item.glossaryId);
          return (
            <Fragment key={item.glossaryId}>
              <tr>
                <td>
                  <span className={`breakdown-category-badge ${badgeClass(item.glossaryType)}`}>{item.typeZh}</span>
                  <span className="breakdown-label">{item.nameZh}</span>
                  {steps.length > 0 ? (
                    <button
                      aria-expanded={isOpen}
                      className="breakdown-steps-toggle"
                      type="button"
                      onClick={() => toggle(item.glossaryId)}
                    >
                      {isOpen ? '▾' : '▸'} 工时明细
                    </button>
                  ) : null}
                  {isBillable && onQuantityChange ? (
                    <QuantityStepper
                      unit={item.unit}
                      value={quantity}
                      onChange={(next) => onQuantityChange(item.glossaryId, next)}
                    />
                  ) : quantity > 1 ? (
                    <span className="breakdown-qty"> ×{quantity} {item.unit}</span>
                  ) : null}
                </td>
                <td className="breakdown-duration">
                  {item.duration > 0 ? `${isBillable ? item.duration * quantity : item.duration} min` : '—'}
                </td>
                <td className="breakdown-price">
                  {item.price > 0 ? `$${(item.price * quantity).toFixed(2)}` : '—'}
                </td>
              </tr>
              {isOpen && steps.length > 0 ? (
                <tr className="breakdown-steps-row">
                  <td colSpan={3}>
                    <ul className="breakdown-steps">
                      {steps.map((step) => (
                        <li key={step.nameZh}>
                          <span>{step.nameZh}</span>
                          <span className="breakdown-steps-min">{step.duration} min</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="breakdown-total">
          <td>总计</td>
          <td className="breakdown-duration">{totalDuration ?? calculatedDuration} min</td>
          <td className="breakdown-price">${(totalPrice ?? calculatedPrice).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

const LABEL_TYPES = new Set(['visual_attribute', 'complexity_level', 'style_tag']);
const TYPE_ZH_LABEL: Record<string, string> = {
  visual_attribute: '视觉效果',
  complexity_level: '复杂度',
  style_tag: '风格',
};

function LabelSummary({ items }: { items: GlossaryBreakdownItem[] }) {
  const labels = items.filter((item) => LABEL_TYPES.has(item.glossaryType));
  if (labels.length === 0) return null;

  const groups = new Map<string, string[]>();
  for (const item of labels) {
    const existing = groups.get(item.glossaryType);
    if (existing) existing.push(item.nameZh);
    else groups.set(item.glossaryType, [item.nameZh]);
  }
  const lines = Array.from(groups.entries()).map(
    ([type, names]) => `${TYPE_ZH_LABEL[type] ?? type}：${names.join('、')}。`,
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

export function BreakdownTable({ result }: { result: BreakdownResult }) {
  const quantities = new Map(result.items.map((item) => [item.glossaryId, item.quantity]));
  return (
    <div className="breakdown-inline">
      <PricedTable
        items={result.items}
        quantities={quantities}
        totalDuration={result.totalDuration}
        totalPrice={result.totalPrice}
      />
      <LabelSummary items={result.items} />
    </div>
  );
}

export function ComponentBreakdownPanel({ image, cachedResult, onResult }: ComponentBreakdownPanelProps) {
  const [result, setResult] = useState<BreakdownResult | null>(cachedResult ?? null);
  const [quantities, setQuantities] = useState<Map<string, number>>(
    () => new Map((cachedResult?.items ?? []).map((item) => [item.glossaryId, item.quantity])),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const lastAnalysedRef = useRef<string | null>(
    cachedResult && image ? image.imageBase64.slice(0, 64) : null,
  );

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
      const response = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: image.imageBase64, mimeType: image.mimeType }),
      });
      const body = (await response.json()) as BreakdownResult & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Breakdown failed.');

      setResult(body);
      setQuantities(new Map(body.items.map((item) => [item.glossaryId, item.quantity])));
      onResult?.(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Breakdown failed.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleQuantityChange(glossaryId: string, quantity: number) {
    if (!result) return;
    const next = new Map(quantities);
    next.set(glossaryId, quantity);
    setQuantities(next);

    const updatedItems = result.items.map((item) => ({
      ...item,
      quantity: next.get(item.glossaryId) ?? item.quantity,
    }));
    const catalogSelections = (result.catalogSelections ?? []).map((selection) => (
      selection.catalogItemId === glossaryId ? { ...selection, quantity } : selection
    ));
    try {
      const quote = await quoteCatalogSelectionsAction(catalogSelections);
      const updated = {
        ...result,
        items: updatedItems,
        catalogSelections,
        totalPrice: quote.totalPriceCents / 100,
        totalDuration: quote.totalDurationMin,
      };
      setResult(updated);
      onResult?.(updated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Quote failed.');
    }
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
      <PricedTable
        items={result.items}
        quantities={quantities}
        totalDuration={result.totalDuration}
        totalPrice={result.totalPrice}
        onQuantityChange={handleQuantityChange}
      />
      <LabelSummary items={result.items} />
      <Button block size="compact" variant="secondary" disabled={isLoading} onClick={handleReAnalyse}>
        重新分析
      </Button>
    </div>
  );
}
