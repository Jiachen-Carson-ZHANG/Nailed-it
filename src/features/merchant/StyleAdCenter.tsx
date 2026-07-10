'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { StyleAdCenterSnapshot } from '@/domain/style-ad';
import { getMerchantAgentRunPath } from '@/domain/session';
import { EmptyState } from '@/components/ui/EmptyState';
import { useLanguage } from '@/i18n/context';
import { getStyleAdCenterSnapshotAction, withdrawStyleAdCampaignAction } from '@/lib/actions/style-ad-actions';

const adCenterCopy = {
  'zh-CN': {
    loading: '正在加载广告数据…',
    loadError: '无法加载广告中心。',
    overview: '投放概览',
    activeCampaigns: '推广中',
    impressions: '曝光',
    clicks: '点击',
    bookings: '预约',
    spend: '花费',
    campaignsTitle: '款式推广',
    emptyTitle: '还没有推广计划',
    emptyBody: '从款式库为已发布款式创建推广，数据会汇总在这里。',
    goToLibrary: '去款式库',
    promote: '推广',
    promoting: '推广中',
    paused: '已暂停',
    ended: '已结束',
    draft: '草稿',
    perDay: '/ 天',
    aiBadge: 'AI 建议',
    why: '为什么？',
    pause: '暂停',
    pauseFailed: '暂停失败，请重试。',
  },
  en: {
    loading: 'Loading ad data…',
    loadError: 'Unable to load the ad center.',
    overview: 'Campaign overview',
    activeCampaigns: 'Active',
    impressions: 'Impressions',
    clicks: 'Clicks',
    bookings: 'Bookings',
    spend: 'Spend',
    campaignsTitle: 'Style campaigns',
    emptyTitle: 'No campaigns yet',
    emptyBody: 'Promote published designs from your style library — performance shows up here.',
    goToLibrary: 'Go to style library',
    promote: 'Promote',
    promoting: 'Promoting',
    paused: 'Paused',
    ended: 'Ended',
    draft: 'Draft',
    perDay: '/ day',
    aiBadge: 'AI proposed',
    why: 'Why?',
    pause: 'Pause',
    pauseFailed: 'Pause failed, please retry.',
  },
} as const;

type AdCenterCopy = (typeof adCenterCopy)[keyof typeof adCenterCopy];

function formatMoney(cents: number): string {
  // The app writes money as "SGD 70.4" everywhere (groupbuy, transcripts) — no bare $ signs.
  const units = cents / 100;
  return `SGD ${Number.isInteger(units) ? units : units.toFixed(2)}`;
}

function statusLabel(status: StyleAdCenterSnapshot['campaigns'][number]['status'], copy: AdCenterCopy) {
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

export function StyleAdCenter() {
  const { language } = useLanguage();
  const copy = adCenterCopy[language];
  const [snapshot, setSnapshot] = useState<StyleAdCenterSnapshot | null>(null);
  const [message, setMessage] = useState('');

  const refresh = useCallback(() => {
    getStyleAdCenterSnapshotAction()
      .then(setSnapshot)
      .catch(() => setMessage(copy.loadError));
  }, [copy.loadError]);

  useEffect(refresh, [refresh]);

  /** The kill switch (ADR-0012 envelope): a live campaign pauses on the spot, no undo hunt required. */
  async function pause(campaignId: string) {
    try {
      await withdrawStyleAdCampaignAction(campaignId);
      refresh();
    } catch {
      setMessage(copy.pauseFailed);
    }
  }

  if (!snapshot && !message) {
    return <p className="helper-copy">{copy.loading}</p>;
  }

  if (!snapshot) {
    return <p className="helper-copy" role="status">{message}</p>;
  }

  return (
    <div className="style-ad-center">
      <section aria-label={copy.overview} className="style-ad-overview-grid">
        <article className="style-ad-stat-card">
          <span className="style-ad-stat-label">{copy.activeCampaigns}</span>
          <strong className="style-ad-stat-value">{snapshot.activeCampaigns}</strong>
        </article>
        <article className="style-ad-stat-card">
          <span className="style-ad-stat-label">{copy.impressions}</span>
          <strong className="style-ad-stat-value">{snapshot.totalImpressions.toLocaleString()}</strong>
        </article>
        <article className="style-ad-stat-card">
          <span className="style-ad-stat-label">{copy.clicks}</span>
          <strong className="style-ad-stat-value">{snapshot.totalClicks.toLocaleString()}</strong>
        </article>
        <article className="style-ad-stat-card">
          <span className="style-ad-stat-label">{copy.bookings}</span>
          <strong className="style-ad-stat-value">{snapshot.totalBookings.toLocaleString()}</strong>
        </article>
        <article className="style-ad-stat-card style-ad-stat-card-wide">
          <span className="style-ad-stat-label">{copy.spend}</span>
          <strong className="style-ad-stat-value">{formatMoney(snapshot.totalSpendCents)}</strong>
        </article>
      </section>

      <section aria-label={copy.campaignsTitle} className="detail-surface">
        <div className="detail-surface-header">
          <h2>{copy.campaignsTitle}</h2>
        </div>

        {snapshot.campaigns.length === 0 ? (
          <EmptyState
            body={copy.emptyBody}
            title={copy.emptyTitle}
          />
        ) : (
          <ul className="style-ad-campaign-list">
            {snapshot.campaigns.map((campaign) => (
              <li key={campaign.id}>
                <Link className="style-ad-campaign-row" href={`/merchant/styles/${campaign.styleId}/ads`}>
                  {campaign.styleImageUrl ? (
                    <img alt="" className="style-ad-campaign-thumb" src={campaign.styleImageUrl} />
                  ) : null}
                  <div className="style-ad-campaign-copy">
                    <strong>
                      {campaign.styleTitle}
                      {campaign.sourceRunId ? <span className="style-ad-ai-badge">{copy.aiBadge}</span> : null}
                    </strong>
                    <p className="helper-copy">
                      {copy.impressions} {campaign.impressions.toLocaleString()} · {copy.clicks} {campaign.clicks.toLocaleString()} · {copy.bookings} {campaign.bookings}
                      {campaign.sourceRunId ? (
                        <>
                          {' · '}
                          <Link className="style-ad-why-link" href={getMerchantAgentRunPath(campaign.sourceRunId)}>
                            {copy.why}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span className={`style-ad-status-badge style-ad-status-${campaign.status}`}>
                    {statusLabel(campaign.status, copy)}
                  </span>
                  {campaign.status === 'active' ? (
                    <button
                      type="button"
                      className="button button-secondary button-compact"
                      onClick={(e) => { e.preventDefault(); void pause(campaign.id); }}
                    >
                      {copy.pause}
                    </button>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link className="button button-secondary button-block" href="/merchant/styles">
        {copy.goToLibrary}
      </Link>
    </div>
  );
}
