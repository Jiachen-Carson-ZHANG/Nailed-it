'use client';

import { useState } from 'react';
import type { BreakdownItem, BreakdownResult, FreeBreakdownItem } from '@/domain/nail';
import { pricingTargetLabels } from '@/domain/nail';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { Button } from '@/components/ui/Button';

type ComponentBreakdownPanelProps = {
  image: SelectedNailImage | null;
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

type EditableFreeItem = FreeBreakdownItem & { id: number };

function FreeBreakdownTable({ initialItems }: { initialItems: FreeBreakdownItem[] }) {
  const [items, setItems] = useState<EditableFreeItem[]>(
    initialItems.map((item, i) => ({ ...item, id: i }))
  );

  function updateItem(id: number, patch: Partial<Pick<FreeBreakdownItem, 'quantity' | 'price'>>) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  const totalPrice = items.reduce((s, item) => s + item.price * item.quantity, 0);
  const totalDuration = items.reduce((s, item) => s + item.duration, 0);

  return (
    <table className="breakdown-table" aria-label="Component breakdown">
      <thead>
        <tr>
          <th>Component</th>
          <th className="breakdown-duration">Min</th>
          <th className="breakdown-price">Qty</th>
          <th className="breakdown-price">Unit $</th>
          <th className="breakdown-price">Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>
              {categoryBadge(item.category)}
              <span className="breakdown-label">{item.label}{item.labelCn ? ` / ${item.labelCn}` : ''}</span>
            </td>
            <td className="breakdown-duration">{item.duration}</td>
            <td className="breakdown-price">
              <input
                className="breakdown-editable-input"
                type="number"
                min={1}
                value={item.quantity}
                aria-label={`Quantity for ${item.label}`}
                onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })}
              />
            </td>
            <td className="breakdown-price">
              <input
                className="breakdown-editable-input"
                type="number"
                min={0}
                step={0.5}
                value={item.price}
                aria-label={`Unit price for ${item.label}`}
                onChange={(e) => updateItem(item.id, { price: Math.max(0, Number(e.target.value)) })}
              />
            </td>
            <td className="breakdown-price">${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="breakdown-total">
          <td>Total</td>
          <td className="breakdown-duration">{totalDuration} min</td>
          <td />
          <td />
          <td className="breakdown-price">${totalPrice.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function StandardBreakdownTable({ result }: { result: BreakdownResult }) {
  return (
    <table className="breakdown-table" aria-label="Component breakdown">
      <tbody>
        {result.items.map((item) => (
          <tr key={`${item.category}-${item.label}`}>
            <td>
              {categoryBadge(item.category)}
              <span className="breakdown-label">{formatLabel(item)}</span>
            </td>
            <td className="breakdown-duration">{item.duration} min</td>
            <td className="breakdown-price">${item.price}</td>
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

export function ComponentBreakdownPanel({ image }: ComponentBreakdownPanelProps) {
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
            <>
              {result.mode === 'free' ? (
                <FreeBreakdownTable
                  initialItems={result.items.filter((i): i is FreeBreakdownItem => i.mode === 'free')}
                />
              ) : (
                <StandardBreakdownTable result={result} />
              )}
            </>
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
