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

// ── Priced table ──────────────────────────────────────────────────────────────
// Covers service_module + billable_component (the two types that have price/duration)
const PRICED_TYPES = new Set(['service_module', 'billable_component']);

function PricedTable({ items }: { items: GlossaryBreakdownItem[] }) {
  const priced = items.filter((i) => PRICED_TYPES.has(i.glossaryType));
  if (priced.length === 0) return null;
  const totalPrice = priced.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalDuration = priced.reduce((s, i) => s + i.duration, 0);
  return (
    <table className="breakdown-table" aria-label="收费项目明细">
      <tbody>
        {priced.map((item) => (
          <tr key={item.glossaryId}>
            <td>
              <span className={`breakdown-category-badge ${badgeClass(item.glossaryType)}`}>
                {item.typeZh}
              </span>
              <span className="breakdown-label">{item.nameZh}</span>
              {item.quantity > 1 && (
                <span className="breakdown-qty"> ×{item.quantity} {item.unit}</span>
              )}
            </td>
            <td className="breakdown-duration">{item.duration > 0 ? `${item.duration} min` : '—'}</td>
            <td className="breakdown-price">
              {item.price > 0 ? `$${(item.price * item.quantity).toFixed(2)}` : '—'}
            </td>
          </tr>
        ))}
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

// ── Label-only table ──────────────────────────────────────────────────────────
// Covers procedure + visual_attribute + complexity_level + style_tag
const LABEL_TYPES = new Set(['procedure', 'visual_attribute', 'complexity_level', 'style_tag']);

function LabelTable({ items }: { items: GlossaryBreakdownItem[] }) {
  const labels = items.filter((i) => LABEL_TYPES.has(i.glossaryType));
  if (labels.length === 0) return null;
  return (
    <table className="breakdown-table breakdown-table-labels" aria-label="风格与工序标签">
      <tbody>
        {labels.map((item) => (
          <tr key={item.glossaryId}>
            <td>
              <span className={`breakdown-category-badge ${badgeClass(item.glossaryType)}`}>
                {item.typeZh}
              </span>
              <span className="breakdown-label">{item.nameZh}</span>
              {item.quantity > 1 && (
                <span className="breakdown-qty"> ×{item.quantity}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Full breakdown export (used by TryOn) ─────────────────────────────────────
export function BreakdownTable({ result }: { result: BreakdownResult }) {
  return (
    <div className="breakdown-inline">
      <PricedTable items={result.items} />
      <LabelTable items={result.items} />
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function ComponentBreakdownPanel({ image, onResult }: ComponentBreakdownPanelProps) {
  const [result, setResult] = useState<BreakdownResult | null>(null);
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

    try {
      const merchantSettings = loadGlossarySettings();
      const response = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image.imageBase64,
          mimeType: image.mimeType,
          merchantSettings
        })
      });

      const body = (await response.json()) as BreakdownResult & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? 'Breakdown failed.');
      }

      setResult(body);
      onResult?.(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Breakdown failed.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleReAnalyse() {
    lastAnalysedRef.current = null;
    void runAnalysis();
  }

  if (isLoading) {
    return (
      <LoadingState
        title="Analysing nail components"
        body="Identifying services from the glossary…"
      />
    );
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
      <PricedTable items={result.items} />
      <LabelTable items={result.items} />
      <Button
        block
        size="compact"
        variant="secondary"
        disabled={isLoading}
        onClick={handleReAnalyse}
      >
        重新分析
      </Button>
    </div>
  );
}
