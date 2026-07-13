'use client';

import { useMemo } from 'react';
import type { AppLanguage } from '@/i18n/types';
import { forecastAd, AD_AUDIENCES, AD_AUDIENCE_ORDER, type AdAudience } from '@/domain/ad-forecast';

const copy = {
  'zh-CN': {
    title: '投前预测',
    hint: '与 AI 投广助手同一套预测模型 · 基于公开先验，实际以监测回流为准',
    bookings: '预计预约',
    cac: '获客成本',
    unit: '单',
    best: '最划算',
    infeasible: '预计 <1 单',
    sat: { low: '', medium: '', high: '受众偏饱和' } as Record<string, string>,
    perDay: (n: number) => `按当前预算 · ${n} 天`,
  },
  en: {
    title: 'Pre-launch forecast',
    hint: 'Same model the AI ad agent uses · from public priors, real results via monitoring',
    bookings: 'Bookings',
    cac: 'Cost / booking',
    unit: '',
    best: 'Best value',
    infeasible: '<1 booking',
    sat: { low: '', medium: '', high: 'audience saturating' } as Record<string, string>,
    perDay: (n: number) => `at current budget · ${n}d`,
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

const money = (cents: number) => `$${Math.round(cents / 100)}`;

/**
 * The forecast the 投广 Agent reasons over, surfaced to the merchant (ADR-0016 sandbox → current UI).
 * For the current budget + duration it forecasts all three audience pools side by side and flags the
 * cheapest FEASIBLE one — the exact "retargeting beats broad" trade-off the agent decides, now visible.
 * Deterministic + client-side (forecastAd is pure); no round-trip, updates live as the merchant edits.
 */
export function AdForecastPanel({
  totalBudgetCents,
  durationDays,
  styleCvr,
  language,
}: {
  totalBudgetCents: number;
  durationDays: number;
  styleCvr?: number;
  language: AppLanguage;
}) {
  const c = copy[language];
  const rows = useMemo(
    () =>
      AD_AUDIENCE_ORDER.map((audience: AdAudience) => ({
        audience,
        prior: AD_AUDIENCES[audience],
        f: forecastAd({ audience, totalBudgetCents, durationDays, styleCvr }),
      })),
    [totalBudgetCents, durationDays, styleCvr],
  );

  // Cheapest feasible pool (>= ~1 booking, has a CAC) = the agent's pick.
  const bestId = rows
    .filter((r) => r.f.expectedBookings[1] >= 1 && r.f.expectedCacCents)
    .sort((a, b) => (a.f.expectedCacCents![0] + a.f.expectedCacCents![1]) - (b.f.expectedCacCents![0] + b.f.expectedCacCents![1]))[0]
    ?.audience;

  return (
    <section className="ad-forecast" aria-label={c.title}>
      <div className="ad-forecast-head">
        <h2 className="style-ad-section-title">{c.title}</h2>
        <span className="ad-forecast-sub">{c.perDay(durationDays)}</span>
      </div>
      <p className="ad-forecast-hint">{c.hint}</p>
      <ul className="ad-forecast-list">
        {rows.map(({ audience, prior, f }) => {
          const feasible = f.expectedBookings[1] >= 1 && f.expectedCacCents;
          return (
            <li key={audience} className={`ad-forecast-row${audience === bestId ? ' ad-forecast-row-best' : ''}`}>
              <div className="ad-forecast-aud">
                <span className="ad-forecast-aud-label">
                  {prior.label[language]}
                  {audience === bestId ? <span className="ad-forecast-best">{c.best}</span> : null}
                </span>
                <span className="ad-forecast-aud-hint">{prior.hint[language]}</span>
              </div>
              <div className="ad-forecast-metrics">
                <span className="ad-forecast-metric">
                  <span className="ad-forecast-metric-label">{c.bookings}</span>
                  <strong className={feasible ? '' : 'ad-forecast-weak'}>
                    {feasible ? `${f.expectedBookings[0]}–${f.expectedBookings[1]}${c.unit}` : c.infeasible}
                  </strong>
                </span>
                <span className="ad-forecast-metric">
                  <span className="ad-forecast-metric-label">{c.cac}</span>
                  <strong>{f.expectedCacCents ? `${money(f.expectedCacCents[0])}–${money(f.expectedCacCents[1])}` : '—'}</strong>
                </span>
                {c.sat[f.saturation] ? <span className="ad-forecast-warn">{c.sat[f.saturation]}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
