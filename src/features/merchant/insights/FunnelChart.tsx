'use client';

import { Fragment } from 'react';
import { useLanguage } from '@/i18n/context';
import { pct, widthPct } from './format';

export type FunnelStage = { label: string; count: number };

const copy = {
  'zh-CN': { worst: '最大流失', small: '样本较小，数值仅供参考' },
  en: { worst: 'Biggest drop', small: 'Small sample — directional only' },
} as const;

/**
 * Stepped journey funnel. Each stage is a bar (width ∝ count); between stages the step
 * conversion is shown, with the biggest-drop step flagged. Never draws an inverted funnel —
 * a stage taller than the one above it is clamped to the upstream width (the count stays honest).
 */
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const { language } = useLanguage();
  const labels = copy[language];
  const max = Math.max(1, ...stages.map((s) => s.count));

  const steps = stages.slice(1).map((stage, i) => {
    const prev = stages[i].count;
    const rate = prev > 0 ? stage.count / prev : 0;
    return { rate, dropShare: prev > 0 ? 1 - rate : 0 };
  });
  const worstIdx = steps.length
    ? steps.reduce((best, step, i, arr) => (step.dropShare > arr[best].dropShare ? i : best), 0)
    : -1;
  const smallSample = stages[0]?.count < 30 || stages.some((s) => s.count > 0 && s.count < 10);

  return (
    <div className="funnel" role="img" aria-label={stages.map((s) => `${s.label} ${s.count}`).join(' → ')}>
      {stages.map((stage, i) => (
        <Fragment key={stage.label}>
          <div className="funnel-row">
            <span className="funnel-row-label">{stage.label}</span>
            <span className="funnel-bar-track">
              <span className="funnel-bar" style={{ width: widthPct(stage.count, max) }} />
            </span>
            <span className="funnel-row-count">{stage.count}</span>
          </div>
          {i < steps.length ? (
            <div className={`funnel-step${worstIdx === i ? ' funnel-step-worst' : ''}`} aria-hidden="true">
              <span className="funnel-step-rate">↓ {pct(steps[i].rate)}</span>
              {worstIdx === i ? <span className="funnel-step-tag">{labels.worst}</span> : null}
            </div>
          ) : null}
        </Fragment>
      ))}
      {smallSample ? <p className="funnel-note">{labels.small}</p> : null}
    </div>
  );
}
