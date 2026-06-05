'use client';

import { useState } from 'react';
import type { BreakdownItem, BreakdownResult, FreeBreakdownItem } from '@/domain/nail';
import { pricingTargetLabels } from '@/domain/nail';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';

type ComponentBreakdownPanelProps = {
  image: SelectedNailImage | null;
  onResult?: (result: BreakdownResult) => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  base: 'Base',
  shape: 'Shape',
  color_style: 'Style',
  addon: 'Add-on',
  other: 'Other'
};

function categoryBadge(category: string) {
  return (
    <span className={`breakdown-category-badge breakdown-category-${category}`}>
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

function formatLabel(item: BreakdownItem): string {
  const baseLabel = item.mode === 'standard'
    ? (pricingTargetLabels[item.label as keyof typeof pricingTargetLabels] ?? item.label)
    : item.label;
  if (item.mode === 'free' && item.labelCn) {
    return `${baseLabel} / ${item.labelCn}`;
  }
  return baseLabel;
}

function rowPrice(item: BreakdownItem): string {
  return item.mode === 'free'
    ? `$${(item.price * item.quantity).toFixed(2)}`
    : `$${item.price}`;
}

export function BreakdownTable({ result }: { result: BreakdownResult }) {
  const items = result.mode === 'free'
    ? result.items.filter((i): i is FreeBreakdownItem => i.mode === 'free')
    : result.items;
  return (
    <table className="breakdown-table" aria-label="Component breakdown">
      <tbody>
        {items.map((item) => (
          <tr key={`${item.category}-${item.label}`}>
            <td>
              {categoryBadge(item.category)}
              <span className="breakdown-label">{formatLabel(item)}</span>
            </td>
            <td className="breakdown-duration">{item.duration} min</td>
            <td className="breakdown-price">{rowPrice(item)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="breakdown-total">
          <td>Total</td>
          <td className="breakdown-duration">{result.totalDuration} min</td>
          <td className="breakdown-price">${result.totalPrice}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function ComponentBreakdownPanel({ image, onResult }: ComponentBreakdownPanelProps) {
  const [freeMode, setFreeMode] = useState(false);
  const [result, setResult] = useState<BreakdownResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  async function loadBreakdown(newFreeMode: boolean) {
    if (!image) return;
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image.imageBase64,
          mimeType: image.mimeType,
          freeMode: newFreeMode
        })
      });

      const body = (await response.json()) as BreakdownResult & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? 'Breakdown failed.');
      }

      setResult(body);
      setExpanded(true);
      onResult?.(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Breakdown failed.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleModeToggle(nextFreeMode: boolean) {
    setFreeMode(nextFreeMode);
    setResult(null);
    setError('');
  }

  return (
    <section className="breakdown-panel">
      <button
        type="button"
        className="breakdown-panel-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Component Breakdown</span>
        <span className="breakdown-toggle-glyph" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="breakdown-panel-body">
          <div className="breakdown-mode-row">
            <span className="helper-copy">Analysis mode</span>
            <div className="breakdown-mode-toggle" role="group" aria-label="Analysis mode">
              <button
                type="button"
                className={`breakdown-mode-btn${!freeMode ? ' breakdown-mode-btn-active' : ''}`}
                onClick={() => handleModeToggle(false)}
              >
                Standard
              </button>
              <button
                type="button"
                className={`breakdown-mode-btn${freeMode ? ' breakdown-mode-btn-active' : ''}`}
                onClick={() => handleModeToggle(true)}
              >
                Free
              </button>
            </div>
          </div>

          <p className="helper-copy">
            {freeMode
              ? 'Free mode lets AI identify any component and estimate its own price and time.'
              : 'Standard mode maps to existing service categories and uses our pricing rules.'}
          </p>

          {error && (
            <section className="summary-card" role="alert">
              <strong>Breakdown error</strong>
              <p>{error}</p>
            </section>
          )}

          {isLoading && (
            <p className="helper-copy" aria-busy="true">Analyzing components…</p>
          )}

          {!isLoading && result && (
            <BreakdownTable result={result} />
          )}

          <Button
            block
            size="compact"
            variant="secondary"
            disabled={!image || isLoading}
            onClick={() => loadBreakdown(freeMode)}
          >
            {isLoading ? 'Analyzing…' : result ? 'Re-analyze' : 'Analyze components'}
          </Button>
        </div>
      )}
    </section>
  );
}
