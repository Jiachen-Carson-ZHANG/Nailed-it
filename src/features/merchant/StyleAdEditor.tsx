'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { StyleAdView } from '@/domain/style-ad';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/i18n/context';
import { getStyleAdAction, launchStyleAdAction } from '@/lib/actions/style-ad-actions';

type PromotionGoal = 'homepage_exposure' | 'booking_conversion';
type PromotionAudience = 'smart' | 'custom';

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
    settingsTitle: '推广设置',
    startTime: '开始时间',
    startNow: '立即开始',
    duration: '持续时间',
    duration7Days: '7 天',
    audience: '受众人群',
    audienceSmart: '智能推荐',
    audienceSmartHint: '系统会在全部人群中自动选择更可能点击和预约的用户',
    audienceCustom: '自定义人群',
    audienceCustomHint: '自定义人群设置即将上线',
    estimateHomepage: (n: number) => `预计曝光提升 ${n.toLocaleString()}`,
    estimateBooking: (n: number) => `预计预约转化提升 ${n.toLocaleString()}`,
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
    settingsTitle: 'Promotion settings',
    startTime: 'Start time',
    startNow: 'Start now',
    duration: 'Duration',
    duration7Days: '7 days',
    audience: 'Audience',
    audienceSmart: 'Smart recommendation',
    audienceSmartHint: 'The system picks users most likely to click and book',
    audienceCustom: 'Custom audience',
    audienceCustomHint: 'Custom audience controls are coming soon',
    estimateHomepage: (n: number) => `Estimated exposure lift ${n.toLocaleString()}`,
    estimateBooking: (n: number) => `Estimated booking lift ${n.toLocaleString()}`,
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
  const [audience, setAudience] = useState<PromotionAudience>('smart');
  const [message, setMessage] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    getStyleAdAction(styleId)
      .then(setAd)
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false));
  }, [styleId]);

  const estimate = useMemo(() => {
    if (goal === 'homepage_exposure') return 2000;
    return 12;
  }, [goal]);

  const estimateText = goal === 'homepage_exposure'
    ? copy.estimateHomepage(estimate)
    : copy.estimateBooking(estimate);

  const audienceHint = audience === 'smart' ? copy.audienceSmartHint : copy.audienceCustomHint;

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
        dailyBudgetCents: ad.dailyBudgetCents ?? 3500,
        durationDays: ad.durationDays ?? 7,
      });
      setAd(launched);
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
      </section>

      <section aria-labelledby="style-ad-settings-title" className="style-ad-section detail-surface">
        <h2 className="style-ad-section-title" id="style-ad-settings-title">{copy.settingsTitle}</h2>

        <button className="style-ad-setting-row" type="button">
          <span className="style-ad-setting-label">{copy.startTime}</span>
          <span className="style-ad-setting-value">
            {copy.startNow}
            <span aria-hidden className="style-ad-setting-caret">›</span>
          </span>
        </button>

        <button className="style-ad-setting-row" type="button">
          <span className="style-ad-setting-label">{copy.duration}</span>
          <span className="style-ad-setting-value">
            {copy.duration7Days}
            <span aria-hidden className="style-ad-setting-caret">›</span>
          </span>
        </button>

        <div className="style-ad-audience-block">
          <p className="style-ad-setting-label">{copy.audience}</p>
          <div className="style-ad-audience-toggle" role="group" aria-label={copy.audience}>
            <button
              aria-pressed={audience === 'smart'}
              className={`style-ad-audience-option${audience === 'smart' ? ' style-ad-audience-option-on' : ''}`}
              type="button"
              onClick={() => setAudience('smart')}
            >
              {copy.audienceSmart}
            </button>
            <button
              aria-pressed={audience === 'custom'}
              className={`style-ad-audience-option${audience === 'custom' ? ' style-ad-audience-option-on' : ''}`}
              type="button"
              onClick={() => setAudience('custom')}
            >
              {copy.audienceCustom}
            </button>
          </div>
          <p className="helper-copy style-ad-audience-hint">{audienceHint}</p>
        </div>
      </section>

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
