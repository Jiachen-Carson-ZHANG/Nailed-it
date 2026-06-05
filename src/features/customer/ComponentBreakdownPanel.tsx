'use client';

import { useState } from 'react';
import type { BreakdownResult, GlossaryBreakdownItem } from '@/domain/nail';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { loadGlossarySettings } from '@/data/glossary-settings-store';
import { Button } from '@/components/ui/Button';

type ComponentBreakdownPanelProps = {
  image: SelectedNailImage | null;
  onResult?: (result: BreakdownResult) => void;
};

export function BreakdownTable({ result }: { result: BreakdownResult }) {
  return (
    <table className="breakdown-table" aria-label="Component breakdown">
      <tbody>
        {result.items.map((item: GlossaryBreakdownItem) => (
          <tr key={item.glossaryId}>
            <td>
              <span className="breakdown-category-badge breakdown-category-other">
                {item.parentNameZh}
              </span>
              <span className="breakdown-label">{item.nameZh}</span>
              {item.quantity > 1 && (
                <span className="breakdown-qty"> ×{item.quantity} {item.unit}</span>
              )}
            </td>
            <td className="breakdown-duration">{item.duration} min</td>
            <td className="breakdown-price">
              ${(item.price * item.quantity).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="breakdown-total">
          <td>总计</td>
          <td className="breakdown-duration">{result.totalDuration} min</td>
          <td className="breakdown-price">${result.totalPrice.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function ComponentBreakdownPanel({ image, onResult }: ComponentBreakdownPanelProps) {
  const [result, setResult] = useState<BreakdownResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  async function loadBreakdown() {
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
      setExpanded(true);
      onResult?.(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Breakdown failed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="breakdown-panel">
      <button
        type="button"
        className="breakdown-panel-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span>服务组件明细</span>
        <span className="breakdown-toggle-glyph" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="breakdown-panel-body">
          {error && (
            <section className="summary-card" role="alert">
              <strong>分析失败</strong>
              <p>{error}</p>
            </section>
          )}

          {isLoading && (
            <p className="helper-copy" aria-busy="true">正在分析组件…</p>
          )}

          {!isLoading && result && (
            <BreakdownTable result={result} />
          )}

          <Button
            block
            size="compact"
            variant="secondary"
            disabled={!image || isLoading}
            onClick={loadBreakdown}
          >
            {isLoading ? '分析中…' : result ? '重新分析' : '分析服务组件'}
          </Button>
        </div>
      )}
    </section>
  );
}
