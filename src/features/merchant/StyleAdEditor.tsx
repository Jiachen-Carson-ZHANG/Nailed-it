'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { PromotionGoal, StyleAdView } from '@/domain/style-ad';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/i18n/context';
import { getStyleAdAction, launchStyleAdAction } from '@/lib/actions/style-ad-actions';
import {
  defaultPromotionSettingsValue,
  StyleAdPromotionSettings,
  type StyleAdPromotionSettingsValue,
} from '@/features/merchant/StyleAdPromotionSettings';
import { forecastAd, deriveAdAudience, forecastRoi, AD_AUDIENCES } from '@/domain/ad-forecast';

// Budget is the merchant's lever (in BOTH smart + custom mode: smart picks WHO, the merchant sets HOW
// MUCH). Slider in cents/day.
const MIN_DAILY_BUDGET_CENTS = 1000;
const MAX_DAILY_BUDGET_CENTS = 10000;
const BUDGET_STEP_CENTS = 500;

const adEditorCopy = {
  'zh-CN': {
    loading: '正在加载推广设置…',
    loadError: '无法加载推广设置，请稍后再试。',
    notFoundTitle: '找不到该款式',
    notFoundBody: '请从款式库选择已发布的款式开始推广。',
    backToLibrary: '返回款式库',
    stylePreview: '推广款式',
    goalTitle: '选择推广目标',
    goalHomepage: '主页曝光',
    goalHomepageHint: '提升款式在主页和发现页的展示次数',
    goalBooking: '预约转化',
    goalBookingHint: '把曝光导向详情页和预约动作',
    budgetTitle: '推广预算',
    perDay: '/ 天',
    totalOver: (n: number) => `共 ${n} 天`,
    forecastTitle: '预计效果',
    forecastHint: '随人群与预算实时测算 · 与 AI 投广助手同一套模型',
    audienceLabel: '当前人群',
    exposure: '预计曝光',
    bookings: '预计预约',
    cac: '获客成本',
    roi: '预计 ROI',
    unit: '单',
    saturated: '受众偏饱和：加预算主要买到重复曝光',
    launch: '一键投广',
    launching: '正在投广…',
    promoting: '推广中',
    paused: '已暂停',
    ended: '已结束',
    draft: '草稿',
    launchSuccess: '推广计划已启动。',
    launchError: '无法启动推广，请稍后再试。',
  },
  en: {
    loading: 'Loading promotion settings…',
    loadError: 'Unable to load promotion settings. Please try again.',
    notFoundTitle: 'Style not found',
    notFoundBody: 'Pick a published design from your style library to start promoting.',
    backToLibrary: 'Back to style library',
    stylePreview: 'Promoted design',
    goalTitle: 'Choose promotion goal',
    goalHomepage: 'Homepage exposure',
    goalHomepageHint: 'Lift impressions on the home feed and discovery surfaces',
    goalBooking: 'Booking conversion',
    goalBookingHint: 'Drive detail views and booking actions from exposure',
    budgetTitle: 'Campaign budget',
    perDay: '/ day',
    totalOver: (n: number) => `over ${n}d`,
    forecastTitle: 'Forecast',
    forecastHint: 'Live from audience + budget · same model the AI ad agent uses',
    audienceLabel: 'Current audience',
    exposure: 'Impressions',
    bookings: 'Bookings',
    cac: 'Cost / booking',
    roi: 'ROI',
    unit: '',
    saturated: 'Audience saturating: more budget mostly buys repeat impressions',
    launch: 'Launch campaign',
    launching: 'Launching…',
    promoting: 'Promoting',
    paused: 'Paused',
    ended: 'Ended',
    draft: 'Draft',
    launchSuccess: 'Campaign launched.',
    launchError: 'Unable to launch this campaign. Please try again.',
  },
} as const;

type AdEditorCopy = (typeof adEditorCopy)[keyof typeof adEditorCopy];

function statusLabel(status: StyleAdView['status'], copy: AdEditorCopy) {
  switch (status) {
    case 'active': return copy.promoting;
    case 'paused': return copy.paused;
    case 'ended': return copy.ended;
    default: return copy.draft;
  }
}

const money = (cents: number) => `$${Math.round(cents / 100)}`;

export function StyleAdEditor({ styleId }: { styleId: string }) {
  const { language } = useLanguage();
  const copy = adEditorCopy[language];
  const [ad, setAd] = useState<StyleAdView | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<PromotionGoal>('homepage_exposure');
  const [dailyBudget, setDailyBudget] = useState(3500);
  const [promotionSettings, setPromotionSettings] = useState<StyleAdPromotionSettingsValue>(defaultPromotionSettingsValue);
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    getStyleAdAction(styleId)
      .then((loaded) => {
        setAd(loaded);
        if (!loaded) return;
        setGoal(loaded.promotionGoal);
        setDailyBudget(loaded.dailyBudgetCents ?? 3500);
        setPromotionSettings({
          startAt: loaded.startAt,
          durationDays: loaded.durationDays,
          audienceMode: loaded.audienceMode,
          customAudience: loaded.customAudience,
        });
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [styleId]);

  // The forecast that fills the fields: audience (标签/消费/年龄) → pool + reach; budget → the lever.
  const forecast = useMemo(() => {
    const { pool, reachMultiplier } = deriveAdAudience(promotionSettings.audienceMode, promotionSettings.customAudience);
    const totalBudgetCents = dailyBudget * promotionSettings.durationDays;
    const f = forecastAd({ audience: pool, totalBudgetCents, durationDays: promotionSettings.durationDays, audienceSizeMultiplier: reachMultiplier });
    const roi = ad ? forecastRoi(f, ad.bookingValueCents, totalBudgetCents) : null;
    return { pool, f, roi, totalBudgetCents };
  }, [promotionSettings, dailyBudget, ad]);

  if (loading) return <p className="helper-copy">{copy.loading}</p>;
  if (loadFailed) return <p className="helper-copy" role="status">{copy.loadError}</p>;
  if (!ad) {
    return (
      <>
        <EmptyState body={copy.notFoundBody} title={copy.notFoundTitle} />
        <Link className="button button-secondary button-block" href="/merchant/styles">{copy.backToLibrary}</Link>
      </>
    );
  }

  async function handleLaunch() {
    if (!ad || isLaunching) return;
    setIsLaunching(true);
    setMessage('');
    try {
      // The forecast fills the campaign's targets — the merchant sets audience + budget, the model
      // derives the exposure/ROI it commits to.
      const f = forecast.f;
      const launched = await launchStyleAdAction({
        styleId: ad.styleId,
        promotionGoal: goal,
        targetExposure: Math.round((f.expectedImpressions[0] + f.expectedImpressions[1]) / 2),
        targetRoi: forecast.roi ? (forecast.roi[0] + forecast.roi[1]) / 2 : ad.targetRoi,
        startAt: promotionSettings.startAt,
        durationDays: promotionSettings.durationDays,
        audienceMode: promotionSettings.audienceMode,
        customAudience: promotionSettings.customAudience,
        dailyBudgetCents: dailyBudget,
      });
      setAd(launched);
      setDailyBudget(launched.dailyBudgetCents ?? dailyBudget);
      setPromotionSettings({
        startAt: launched.startAt,
        durationDays: launched.durationDays,
        audienceMode: launched.audienceMode,
        customAudience: launched.customAudience,
      });
      setMessage(copy.launchSuccess);
    } catch {
      setMessage(copy.launchError);
    } finally {
      setIsLaunching(false);
    }
  }

  const { f, roi } = forecast;
  const poolLabel = AD_AUDIENCES[forecast.pool].label[language];

  return (
    <div className="style-ad-editor">
      <article className="style-ad-preview-compact">
        {ad.styleImageUrl ? <img alt="" className="style-ad-preview-compact-thumb" src={ad.styleImageUrl} /> : null}
        <div className="style-ad-preview-compact-copy">
          <span className="helper-copy">{copy.stylePreview}</span>
          <strong>{ad.styleTitle}</strong>
        </div>
        <span className={`style-ad-status-badge style-ad-status-${ad.status}`}>{statusLabel(ad.status, copy)}</span>
      </article>

      <section aria-labelledby="style-ad-goal-title" className="style-ad-section">
        <h2 className="style-ad-section-title" id="style-ad-goal-title">{copy.goalTitle}</h2>
        <div className="style-ad-goal-grid" role="group" aria-label={copy.goalTitle}>
          <button aria-pressed={goal === 'homepage_exposure'} className={`style-ad-goal-card${goal === 'homepage_exposure' ? ' style-ad-goal-card-on' : ''}`} type="button" onClick={() => setGoal('homepage_exposure')}>
            <strong>{copy.goalHomepage}</strong>
            <span className="helper-copy">{copy.goalHomepageHint}</span>
          </button>
          <button aria-pressed={goal === 'booking_conversion'} className={`style-ad-goal-card${goal === 'booking_conversion' ? ' style-ad-goal-card-on' : ''}`} type="button" onClick={() => setGoal('booking_conversion')}>
            <strong>{copy.goalBooking}</strong>
            <span className="helper-copy">{copy.goalBookingHint}</span>
          </button>
        </div>
      </section>

      <StyleAdPromotionSettings value={promotionSettings} onChange={setPromotionSettings} />

      <section className="style-ad-section" aria-label={copy.budgetTitle}>
        <div className="style-ad-budget-head">
          <h2 className="style-ad-section-title">{copy.budgetTitle}</h2>
          <span className="style-ad-budget-value">{money(dailyBudget)}<span className="style-ad-budget-per">{copy.perDay}</span></span>
        </div>
        <input
          aria-label={copy.budgetTitle}
          className="style-ad-roi-slider"
          type="range"
          min={MIN_DAILY_BUDGET_CENTS}
          max={MAX_DAILY_BUDGET_CENTS}
          step={BUDGET_STEP_CENTS}
          value={dailyBudget}
          onChange={(e) => setDailyBudget(Number(e.target.value))}
        />
        <div className="style-ad-budget-total">{money(forecast.totalBudgetCents)} · {copy.totalOver(promotionSettings.durationDays)}</div>
      </section>

      {/* The forecast FILLS these fields — driven live by audience + budget (no separate panel). */}
      <section className="style-ad-section ad-forecast-live" aria-label={copy.forecastTitle}>
        <div className="ad-forecast-head">
          <h2 className="style-ad-section-title">{copy.forecastTitle}</h2>
          <span className="ad-forecast-sub">{copy.audienceLabel}：{poolLabel}</span>
        </div>
        <p className="ad-forecast-hint">{copy.forecastHint}</p>
        <div className="ad-forecast-grid">
          <div className={`ad-forecast-cell${goal === 'homepage_exposure' ? ' ad-forecast-cell-primary' : ''}`}>
            <span className="ad-forecast-cell-label">{copy.exposure}</span>
            <strong>{f.expectedImpressions[0].toLocaleString()}–{f.expectedImpressions[1].toLocaleString()}</strong>
          </div>
          <div className="ad-forecast-cell">
            <span className="ad-forecast-cell-label">{copy.bookings}</span>
            <strong>{f.expectedBookings[0]}–{f.expectedBookings[1]}{copy.unit}</strong>
          </div>
          <div className="ad-forecast-cell">
            <span className="ad-forecast-cell-label">{copy.cac}</span>
            <strong>{f.expectedCacCents ? `${money(f.expectedCacCents[0])}–${money(f.expectedCacCents[1])}` : '—'}</strong>
          </div>
          <div className={`ad-forecast-cell${goal === 'booking_conversion' ? ' ad-forecast-cell-primary' : ''}`}>
            <span className="ad-forecast-cell-label">{copy.roi}</span>
            <strong>{roi ? `${roi[0].toFixed(1)}–${roi[1].toFixed(1)}×` : '—'}</strong>
          </div>
        </div>
        {f.saturation === 'high' ? <p className="ad-forecast-sat">{copy.saturated}</p> : null}
      </section>

      {message ? <p className="helper-copy" role="status">{message}</p> : null}

      <div className="style-ad-checkout-bar" aria-label={copy.launch}>
        <div className="style-ad-checkout-estimate">{copy.bookings} {f.expectedBookings[0]}–{f.expectedBookings[1]}{copy.unit} · {copy.cac} {f.expectedCacCents ? `${money(f.expectedCacCents[0])}–${money(f.expectedCacCents[1])}` : '—'}</div>
        <div className="style-ad-checkout-actions">
          <div className="style-ad-checkout-price">
            <span className="helper-copy">{copy.budgetTitle}</span>
            <strong>{money(dailyBudget)}{copy.perDay}</strong>
          </div>
          <button className="button button-primary button-default style-ad-launch-button" disabled={isLaunching} type="button" onClick={handleLaunch}>
            {isLaunching ? copy.launching : copy.launch}
          </button>
        </div>
      </div>
    </div>
  );
}
