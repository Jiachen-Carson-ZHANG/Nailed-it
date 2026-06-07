'use client';

import { useEffect, useState } from 'react';
import {
  getCustomerIntelligenceAction,
  type CustomerIntelResult,
} from '@/lib/actions/customer-intel-actions';
import { sendMerchantStyleRecommendationAction } from '@/lib/actions/conversation-actions';
import type { Conversation } from '@/domain/nail';
import { isGenericTag } from '@/domain/catalog-tags';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';

const intelCopy = {
  'zh-CN': {
    loading: '正在加载顾客画像…',
    panelAria: (name: string) => `顾客画像 ${name}`,
    title: '顾客画像',
    stylePrefs: '风格偏好',
    budget: '预算',
    engagement: '互动',
    engagementCount: (n: number) => `${n} 次`,
    recommend: '推荐发送',
    match: (tags: string) => `匹配 ${tags}`,
    sent: '已发送 ✓',
  },
  en: {
    loading: 'Loading customer profile…',
    panelAria: (name: string) => `Customer profile for ${name}`,
    title: 'Customer profile',
    stylePrefs: 'Style preferences',
    budget: 'Budget',
    engagement: 'Engagement',
    engagementCount: (n: number) => `${n} events`,
    recommend: 'Recommended to send',
    match: (tags: string) => `Matches ${tags}`,
    sent: 'Sent ✓',
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

export function CustomerIntelPanel({
  customerName,
  conversationId,
  onRecommendSent,
}: {
  customerName: string;
  conversationId: string;
  /** Called with the updated thread after a recommendation is posted, so the chat re-renders. */
  onRecommendSent?: (conversation: Conversation) => void;
}) {
  const { language, t } = useLanguage();
  const copy = intelCopy[language];
  const [intel, setIntel] = useState<CustomerIntelResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    getCustomerIntelligenceAction(customerName)
      .then((data) => active && setIntel(data))
      .catch(() => {/* no panel */})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [customerName]);

  if (loading) return <p className="helper-copy">{copy.loading}</p>;
  // No panel for an unknown customer or one with no behavioural history — never fake a profile.
  if (!intel || intel.profile.eventCount === 0) return null;

  const profile = intel.profile;
  // The linked appointment now lives in the chat thread's inline card, not here (avoids a duplicate).
  // Show distinctive taste tags, not generic descriptors (亮面 / 日常通勤 / 果冻感).
  const prefTags = profile.topTags.filter((t) => !isGenericTag(t)).slice(0, 6);

  async function send(
    style: { id: string; title: string; imageUrl: string },
    matchTags: string[],
  ) {
    setSent((prev) => new Set(prev).add(style.id));
    const updated = await sendMerchantStyleRecommendationAction(conversationId, {
      customerId: profile.customerId,
      styleId: style.id,
      title: style.title,
      imageUrl: style.imageUrl,
      reason: matchTags.length > 0 ? matchTags.join(' · ') : undefined,
    });
    if (updated) onRecommendSent?.(updated);
  }

  return (
    <section className="detail-surface intel-panel" aria-label={copy.panelAria(customerName)}>
      <div className="detail-surface-header">
        <h2>{copy.title}</h2>
        <span className="insights-badge">Nailed AI</span>
      </div>

      <p className="intel-name">{customerName}</p>

      {prefTags.length > 0 ? (
        <>
          <p className="intel-section-label">{copy.stylePrefs}</p>
          <div className="intel-chip-row">
            {prefTags.map((tag) => (
              <span key={tag} className="intel-chip">{tag}</span>
            ))}
          </div>
        </>
      ) : null}

      <div className="intel-stat-row">
        <div className="intel-stat">
          <span>{copy.budget}</span>
          <strong>{profile.averageBudget != null ? `SGD ${profile.averageBudget}` : '—'}</strong>
        </div>
        <div className="intel-stat">
          <span>{copy.engagement}</span>
          <strong>{copy.engagementCount(profile.eventCount)}</strong>
        </div>
      </div>

      {intel.recommendations.length > 0 ? (
        <>
          <p className="intel-section-label">{copy.recommend}</p>
          <div className="intel-reco-list">
            {intel.recommendations.map(({ style, reasonCodes, reasonText }) => {
              const tags = reasonCodes.filter((c) => c.startsWith('tag:')).map((c) => c.slice(4));
              const reason = tags.length > 0 ? copy.match(tags.join(' · ')) : reasonText;
              return (
              <div key={style.id} className="intel-reco-row">
                <img className="intel-reco-thumb" src={style.imageUrl} alt={style.title} loading="lazy" />
                <div className="intel-reco-body">
                  <p className="intel-reco-title">{style.title}</p>
                  <p className="intel-reco-reason">{reason}</p>
                </div>
                <button
                  type="button"
                  className="button button-secondary button-compact"
                  disabled={sent.has(style.id)}
                  onClick={() => void send(style, tags)}
                >
                  {sent.has(style.id) ? copy.sent : t('common.send')}
                </button>
              </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
