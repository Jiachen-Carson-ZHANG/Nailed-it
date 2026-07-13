'use client';

import { useMemo, useState } from 'react';
import type { AppLanguage } from '@/i18n/types';
import type { AudienceMode, StyleAdCustomAudience } from '@/domain/style-ad';
import { MIN_AUDIENCE_AGE, MAX_AUDIENCE_AGE } from '@/domain/style-ad';
import { forecastAd, AD_AUDIENCES, AD_AUDIENCE_ORDER, type AdAudience } from '@/domain/ad-forecast';

type PoolChoice = 'auto' | AdAudience;

const copy = {
  'zh-CN': {
    title: '投前预测',
    hint: '与 AI 投广助手同一套预测模型 · 行为分层定基础转化，人群属性只收窄覆盖',
    layerLabel: '行为分层',
    auto: '系统智选',
    bookings: '预计预约',
    cac: '获客成本',
    reach: '覆盖约',
    people: '人',
    unit: '单',
    best: '最划算',
    yours: '你选的',
    infeasible: '预计 <1 单',
    sat: { low: '', medium: '', high: '受众偏饱和' } as Record<string, string>,
    narrow: (m: number) => `窄定向 ×${m.toFixed(2)}`,
    perDay: (n: number) => `按当前预算 · ${n} 天`,
  },
  en: {
    title: 'Pre-launch forecast',
    hint: 'Same model the AI ad agent uses · behavioral layer sets conversion, demographics only narrow reach',
    layerLabel: 'Behavioral layer',
    auto: 'Auto-pick',
    bookings: 'Bookings',
    cac: 'Cost / booking',
    reach: 'Reach ~',
    people: '',
    unit: '',
    best: 'Best value',
    yours: 'Yours',
    infeasible: '<1 booking',
    sat: { low: '', medium: '', high: 'audience saturating' } as Record<string, string>,
    narrow: (m: number) => `narrowed ×${m.toFixed(2)}`,
    perDay: (n: number) => `at current budget · ${n}d`,
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

const money = (cents: number) => `$${Math.round(cents / 100)}`;

/** Demographic narrowing → a reach multiplier (0..1). Behavioral pool is orthogonal; 年龄/标签/频次/单价
 *  only shrink WHO is reachable, never the per-click conversion. Smart mode = no manual narrowing. */
function reachMultiplier(mode: AudienceMode, custom?: StyleAdCustomAudience): number {
  if (mode !== 'custom' || !custom) return 1;
  const ageFrac = Math.max(1, custom.ageMax - custom.ageMin) / (MAX_AUDIENCE_AGE - MIN_AUDIENCE_AGE);
  const tagNarrow = 0.75 ** custom.preferenceTags.length;
  const freqNarrow = custom.visitFrequency ? 0.8 : 1;
  const priceNarrow = custom.unitPrice ? 0.8 : 1;
  return Math.min(1, Math.max(0.08, ageFrac * tagNarrow * freqNarrow * priceNarrow));
}

/**
 * The forecast the 投广 Agent reasons over, surfaced to the merchant (ADR-0016 sandbox → current UI). The
 * merchant picks a 行为分层 (the sandbox's behavioral pool) — that sets CTR/CVR/CAC — while the existing
 * 年龄/标签 filter only narrows REACH (fewer people → more saturation at the same budget). So the two
 * audience vocabularies finally speak one language. Deterministic + client-side; updates live.
 */
export function AdForecastPanel({
  totalBudgetCents,
  durationDays,
  styleCvr,
  audienceMode,
  customAudience,
  language,
}: {
  totalBudgetCents: number;
  durationDays: number;
  styleCvr?: number;
  audienceMode: AudienceMode;
  customAudience?: StyleAdCustomAudience;
  language: AppLanguage;
}) {
  const c = copy[language];
  const [pool, setPool] = useState<PoolChoice>('auto');
  const reach = useMemo(() => reachMultiplier(audienceMode, customAudience), [audienceMode, customAudience]);

  const rows = useMemo(
    () =>
      AD_AUDIENCE_ORDER.map((audience: AdAudience) => ({
        audience,
        prior: AD_AUDIENCES[audience],
        f: forecastAd({ audience, totalBudgetCents, durationDays, styleCvr, audienceSizeMultiplier: reach }),
      })),
    [totalBudgetCents, durationDays, styleCvr, reach],
  );

  const bestId = rows
    .filter((r) => r.f.expectedBookings[1] >= 1 && r.f.expectedCacCents)
    .sort((a, b) => (a.f.expectedCacCents![0] + a.f.expectedCacCents![1]) - (b.f.expectedCacCents![0] + b.f.expectedCacCents![1]))[0]
    ?.audience;
  const highlighted = pool === 'auto' ? bestId : pool;

  return (
    <section className="ad-forecast" aria-label={c.title}>
      <div className="ad-forecast-head">
        <h2 className="style-ad-section-title">{c.title}</h2>
        <span className="ad-forecast-sub">{c.perDay(durationDays)}</span>
      </div>
      <p className="ad-forecast-hint">{c.hint}</p>

      <div className="ad-forecast-layer" role="group" aria-label={c.layerLabel}>
        <span className="ad-forecast-layer-label">{c.layerLabel}</span>
        <div className="ad-forecast-chips">
          <button type="button" aria-pressed={pool === 'auto'} className={`ad-forecast-chip${pool === 'auto' ? ' ad-forecast-chip-on' : ''}`} onClick={() => setPool('auto')}>
            {c.auto}
          </button>
          {AD_AUDIENCE_ORDER.map((a) => (
            <button key={a} type="button" aria-pressed={pool === a} className={`ad-forecast-chip${pool === a ? ' ad-forecast-chip-on' : ''}`} onClick={() => setPool(a)}>
              {AD_AUDIENCES[a].label[language]}
            </button>
          ))}
        </div>
        {reach < 1 ? <span className="ad-forecast-narrow">{c.narrow(reach)}</span> : null}
      </div>

      <ul className="ad-forecast-list">
        {rows.map(({ audience, prior, f }) => {
          const feasible = f.expectedBookings[1] >= 1 && f.expectedCacCents;
          const isHi = audience === highlighted;
          const people = Math.round(prior.size * reach);
          return (
            <li key={audience} className={`ad-forecast-row${isHi ? ' ad-forecast-row-best' : ''}`}>
              <div className="ad-forecast-aud">
                <span className="ad-forecast-aud-label">
                  {prior.label[language]}
                  {isHi ? <span className="ad-forecast-best">{pool === 'auto' ? c.best : c.yours}</span> : null}
                </span>
                <span className="ad-forecast-aud-hint">{c.reach} {people.toLocaleString()}{c.people} · {prior.hint[language]}</span>
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
