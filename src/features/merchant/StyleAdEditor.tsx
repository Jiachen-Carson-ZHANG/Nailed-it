'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { PromotionGoal, StyleAdView } from '@/domain/style-ad';
import {
  DEFAULT_TARGET_EXPOSURE,
  DEFAULT_TARGET_ROI,
  clampTargetExposure,
  exposureTargetPresets,
  isExposurePreset,
  MAX_TARGET_EXPOSURE,
  MAX_TARGET_ROI,
  MIN_TARGET_EXPOSURE,
  MIN_TARGET_ROI,
} from '@/domain/style-ad';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/i18n/context';
import { getStyleAdAction, launchStyleAdAction } from '@/lib/actions/style-ad-actions';
import {
  defaultPromotionSettingsValue,
  StyleAdPromotionSettings,
  type StyleAdPromotionSettingsValue,
} from '@/features/merchant/StyleAdPromotionSettings';
import { AdForecastPanel } from '@/features/merchant/AdForecastPanel';

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
    targetExposure: '目标曝光量',
    targetExposureCustom: '自定义',
    targetExposureRange: '1,000 - 1,000,000',
    targetRoi: '目标 ROI',
    estimateHomepage: (n: number) => `预计曝光提升 ${n.toLocaleString()}`,
    estimateBooking: (roi: number) => `目标 ROI ${roi.toFixed(1)}×`,
    payLabel: '推广预算',
    launch: '一键投广',
    launching: '正在投广…',
    draft: '草稿',
    promoting: '推广中',
    paused: '已暂停',
    ended: '已结束',
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
    targetExposure: 'Target impressions',
    targetExposureCustom: 'Custom',
    targetExposureRange: '1,000 - 1,000,000',
    targetRoi: 'Target ROI',
    estimateHomepage: (n: number) => `Estimated exposure lift ${n.toLocaleString()}`,
    estimateBooking: (roi: number) => `Target ROI ${roi.toFixed(1)}×`,
    payLabel: 'Campaign budget',
    launch: 'Launch campaign',
    launching: 'Launching…',
    draft: 'Draft',
    promoting: 'Promoting',
    paused: 'Paused',
    ended: 'Ended',
    launchSuccess: 'Campaign launched.',
    launchError: 'Unable to launch this campaign. Please try again.',
  },
} as const;

type AdEditorCopy = (typeof adEditorCopy)[keyof typeof adEditorCopy];

function statusLabel(status: StyleAdView['status'], copy: AdEditorCopy) {
  switch (status) {
    case 'active':
      return copy.promoting;
    case 'paused':
      return copy.paused;
    case 'ended':
      return copy.ended;
    default:
      return copy.draft;
  }
}

function formatBudget(cents: number | null): string {
  if (cents === null) return '$35.00';
  return `$${(cents / 100).toFixed(2)}`;
}

export function StyleAdEditor({ styleId }: { styleId: string }) {
  const { language } = useLanguage();
  const copy = adEditorCopy[language];
  const [ad, setAd] = useState<StyleAdView | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState<PromotionGoal>('homepage_exposure');
  const [targetExposure, setTargetExposure] = useState(DEFAULT_TARGET_EXPOSURE);
  const [exposureCustom, setExposureCustom] = useState(false);
  const [customExposureInput, setCustomExposureInput] = useState(String(DEFAULT_TARGET_EXPOSURE));
  const [targetRoi, setTargetRoi] = useState(DEFAULT_TARGET_ROI);
  const [promotionSettings, setPromotionSettings] = useState<StyleAdPromotionSettingsValue>(
    defaultPromotionSettingsValue,
  );
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
        setTargetExposure(loaded.targetExposure);
        const custom = !isExposurePreset(loaded.targetExposure);
        setExposureCustom(custom);
        setCustomExposureInput(String(loaded.targetExposure));
        setTargetRoi(loaded.targetRoi);
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

  const estimateText = useMemo(() => {
    if (goal === 'homepage_exposure') return copy.estimateHomepage(targetExposure);
    return copy.estimateBooking(targetRoi);
  }, [copy, goal, targetExposure, targetRoi]);

  if (loading) {
    return <p className="helper-copy">{copy.loading}</p>;
  }

  if (loadFailed) {
    return <p className="helper-copy" role="status">{copy.loadError}</p>;
  }

  if (!ad) {
    return (
      <>
        <EmptyState body={copy.notFoundBody} title={copy.notFoundTitle} />
        <Link className="button button-secondary button-block" href="/merchant/styles">
          {copy.backToLibrary}
        </Link>
      </>
    );
  }

  async function handleLaunch() {
    if (!ad || isLaunching) return;
    setIsLaunching(true);
    setMessage('');
    try {
      const launched = await launchStyleAdAction({
        styleId: ad.styleId,
        promotionGoal: goal,
        targetExposure,
        targetRoi,
        startAt: promotionSettings.startAt,
        durationDays: promotionSettings.durationDays,
        audienceMode: promotionSettings.audienceMode,
        customAudience: promotionSettings.customAudience,
        dailyBudgetCents: ad.dailyBudgetCents ?? 3500,
      });
      setAd(launched);
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

  return (
    <div className="style-ad-editor">
      <article className="style-ad-preview-compact">
        {ad.styleImageUrl ? (
          <img alt="" className="style-ad-preview-compact-thumb" src={ad.styleImageUrl} />
        ) : null}
        <div className="style-ad-preview-compact-copy">
          <span className="helper-copy">{copy.stylePreview}</span>
          <strong>{ad.styleTitle}</strong>
        </div>
        <span className={`style-ad-status-badge style-ad-status-${ad.status}`}>
          {statusLabel(ad.status, copy)}
        </span>
      </article>

      <section aria-labelledby="style-ad-goal-title" className="style-ad-section">
        <h2 className="style-ad-section-title" id="style-ad-goal-title">{copy.goalTitle}</h2>
        <div className="style-ad-goal-grid" role="group" aria-label={copy.goalTitle}>
          <button
            aria-pressed={goal === 'homepage_exposure'}
            className={`style-ad-goal-card${goal === 'homepage_exposure' ? ' style-ad-goal-card-on' : ''}`}
            type="button"
            onClick={() => setGoal('homepage_exposure')}
          >
            <strong>{copy.goalHomepage}</strong>
            <span className="helper-copy">{copy.goalHomepageHint}</span>
          </button>
          <button
            aria-pressed={goal === 'booking_conversion'}
            className={`style-ad-goal-card${goal === 'booking_conversion' ? ' style-ad-goal-card-on' : ''}`}
            type="button"
            onClick={() => setGoal('booking_conversion')}
          >
            <strong>{copy.goalBooking}</strong>
            <span className="helper-copy">{copy.goalBookingHint}</span>
          </button>
        </div>

        {goal === 'homepage_exposure' ? (
          <div className="style-ad-goal-target">
            <p className="style-ad-setting-label">{copy.targetExposure}</p>
            <div className="style-ad-exposure-presets" role="group" aria-label={copy.targetExposure}>
              {exposureTargetPresets.map((preset) => (
                <button
                  key={preset}
                  aria-pressed={!exposureCustom && targetExposure === preset}
                  className={`style-ad-exposure-preset${!exposureCustom && targetExposure === preset ? ' style-ad-exposure-preset-on' : ''}`}
                  type="button"
                  onClick={() => {
                    setExposureCustom(false);
                    setTargetExposure(preset);
                  }}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
              <button
                aria-pressed={exposureCustom}
                className={`style-ad-exposure-preset${exposureCustom ? ' style-ad-exposure-preset-on' : ''}`}
                type="button"
                onClick={() => {
                  setExposureCustom(true);
                  setCustomExposureInput(String(targetExposure));
                }}
              >
                {copy.targetExposureCustom}
              </button>
            </div>
            {exposureCustom ? (
              <label className="style-ad-exposure-custom">
                <span className="sr-only">{copy.targetExposure}</span>
                <input
                  aria-describedby="style-ad-exposure-range-hint"
                  className="style-ad-exposure-custom-input"
                  inputMode="numeric"
                  max={MAX_TARGET_EXPOSURE}
                  min={MIN_TARGET_EXPOSURE}
                  step={1}
                  type="number"
                  value={customExposureInput}
                  onBlur={() => {
                    const parsed = Number(customExposureInput);
                    const clamped = clampTargetExposure(Number.isFinite(parsed) ? parsed : MIN_TARGET_EXPOSURE);
                    setTargetExposure(clamped);
                    setCustomExposureInput(String(clamped));
                  }}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setCustomExposureInput(raw);
                    const parsed = Number(raw);
                    if (raw !== '' && Number.isInteger(parsed)) {
                      setTargetExposure(clampTargetExposure(parsed));
                    }
                  }}
                />
                <span className="helper-copy" id="style-ad-exposure-range-hint">{copy.targetExposureRange}</span>
              </label>
            ) : null}
          </div>
        ) : (
          <div className="style-ad-goal-target">
            <div className="style-ad-roi-header">
              <p className="style-ad-setting-label">{copy.targetRoi}</p>
              <strong className="style-ad-roi-value">{targetRoi.toFixed(1)}×</strong>
            </div>
            <input
              aria-label={copy.targetRoi}
              className="style-ad-roi-slider"
              max={MAX_TARGET_ROI}
              min={MIN_TARGET_ROI}
              step={0.1}
              type="range"
              value={targetRoi}
              onChange={(event) => setTargetRoi(Number(event.target.value))}
            />
            <div aria-hidden className="style-ad-roi-scale">
              <span>{MIN_TARGET_ROI.toFixed(1)}</span>
              <span>{MAX_TARGET_ROI.toFixed(1)}</span>
            </div>
          </div>
        )}
      </section>

      <StyleAdPromotionSettings
        value={promotionSettings}
        onChange={setPromotionSettings}
      />

      <AdForecastPanel
        totalBudgetCents={(ad.dailyBudgetCents ?? 3500) * promotionSettings.durationDays}
        durationDays={promotionSettings.durationDays}
        language={language}
      />

      {message ? <p className="helper-copy" role="status">{message}</p> : null}

      <div className="style-ad-checkout-bar" aria-label={copy.launch}>
        <div className="style-ad-checkout-estimate">{estimateText}</div>
        <div className="style-ad-checkout-actions">
          <div className="style-ad-checkout-price">
            <span className="helper-copy">{copy.payLabel}</span>
            <strong>{formatBudget(ad.dailyBudgetCents)}</strong>
          </div>
          <button
            className="button button-primary button-default style-ad-launch-button"
            disabled={isLaunching}
            type="button"
            onClick={handleLaunch}
          >
            {isLaunching ? copy.launching : copy.launch}
          </button>
        </div>
      </div>
    </div>
  );
}
