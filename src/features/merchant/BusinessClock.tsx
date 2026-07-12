'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';
import { getPeriod, revealedPeriods } from '@/domain/business-clock';

// The demo's Day 0 (the finals-a trace date). The clock shows base + period.day.
const BASE_DATE = new Date(2026, 6, 12);
const STORE_KEY = 'nailed-clock-revealed';

const copy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 业务时钟',
    title: '业务时钟',
    body: '推进业务时钟，看 AI 团队如何跨时间投放、复盘、修订与记忆。',
    day: (n: number) => `第 ${n} 天`,
    period: (n: number) => `第 ${n} 期`,
    advance: '推进业务时钟',
    reset: '重置',
    simTag: '模拟',
    latest: '最新',
  },
  en: {
    eyebrow: 'Nailed AI · Business clock',
    title: 'Business clock',
    body: 'Advance the clock to watch the AI team place, measure, revise, and remember across time.',
    day: (n: number) => `Day ${n}`,
    period: (n: number) => `Period ${n}`,
    advance: 'Advance the clock',
    reset: 'Reset',
    simTag: 'Simulated',
    latest: 'Latest',
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

function fmtDate(day: number, language: AppLanguage): string {
  const d = new Date(BASE_DATE.getTime() + day * 86_400_000);
  return d.toLocaleDateString(language === 'zh-CN' ? 'zh-CN' : 'en-GB', { month: 'short', day: 'numeric' });
}

export function BusinessClock() {
  const { language } = useLanguage();
  const c = copy[language];
  // Start at 1 (Day 0 shown); hydrate from localStorage after mount to avoid an SSR mismatch.
  const [revealed, setRevealed] = useState(1);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(STORE_KEY));
    if (Number.isFinite(saved) && saved >= 1) setRevealed(saved);
  }, []);

  function persist(next: number) {
    setRevealed(next);
    try { window.localStorage.setItem(STORE_KEY, String(next)); } catch {/* private mode */}
  }

  const current = getPeriod(revealed - 1);
  // Newest period first, so each advance surfaces the new beat at the top.
  const periods = revealedPeriods(revealed).map((p, i) => ({ p, index: i })).reverse();

  return (
    <section className="detail-surface clock-card" aria-labelledby="clock-title">
      <div className="detail-surface-header">
        <div>
          <p className="section-eyebrow">{c.eyebrow}</p>
          <h2 id="clock-title">{c.title}</h2>
        </div>
        <span className="clock-date-badge">{fmtDate(current.day, language)}</span>
      </div>
      <p className="clock-body">{c.body}</p>

      <div className="clock-controls">
        <div className="clock-now">
          <span className="clock-now-day">{c.day(current.day)}</span>
          <span className="clock-now-period">{c.period(revealed)}</span>
        </div>
        <div className="clock-actions">
          <button type="button" className="button button-primary clock-advance" onClick={() => persist(revealed + 1)}>
            <span>{c.advance}</span>
            <span className="clock-advance-mark" aria-hidden="true">→</span>
          </button>
          {revealed > 1 ? (
            <button type="button" className="button button-secondary button-compact" onClick={() => persist(1)}>
              {c.reset}
            </button>
          ) : null}
        </div>
      </div>

      <ol className="clock-timeline">
        {periods.map(({ p, index }) => (
          <li key={index} className={`clock-item clock-tone-${p.tone}${index === revealed - 1 ? ' clock-item-latest' : ''}`}>
            <div className="clock-item-head">
              <span className={`clock-pill clock-pill-${p.tone}`}>{p.label[language]}</span>
              <span className="clock-item-date">{fmtDate(p.day, language)} · {c.day(p.day)}</span>
              {index === revealed - 1 ? <span className="clock-latest-tag">{c.latest}</span> : null}
              {p.simulated ? <span className="clock-sim-tag">{c.simTag}</span> : null}
            </div>
            <p className="clock-headline">{p.headline[language]}</p>
            <p className="clock-detail">{p.detail[language]}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
