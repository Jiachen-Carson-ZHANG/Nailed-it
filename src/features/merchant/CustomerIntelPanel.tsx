'use client';

import { useEffect, useState } from 'react';
import {
  getCustomerIntelligenceAction,
  recordRecommendedStyleAction,
  type CustomerIntelResult,
} from '@/lib/actions/customer-intel-actions';

function formatAppointment(startAt: string): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return startAt;
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CustomerIntelPanel({ customerName }: { customerName: string }) {
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

  if (loading) return <p className="helper-copy">加载顾客画像…</p>;
  // No panel for an unknown customer or one with no behavioural history — never fake a profile.
  if (!intel || intel.profile.eventCount === 0) return null;

  const profile = intel.profile;

  async function send(styleId: string) {
    setSent((prev) => new Set(prev).add(styleId));
    await recordRecommendedStyleAction({ customerId: profile.customerId, styleId });
  }

  return (
    <section className="detail-surface intel-panel" aria-label={`顾客画像 ${customerName}`}>
      <div className="detail-surface-header">
        <h2>顾客画像 · {customerName}</h2>
        <span className="insights-badge">Nailed AI</span>
      </div>

      {profile.topTags.length > 0 ? (
        <div className="intel-chip-row">
          {profile.topTags.slice(0, 6).map((tag) => (
            <span key={tag} className="intel-chip">{tag}</span>
          ))}
        </div>
      ) : null}

      <p className="intel-meta">
        {profile.averageBudget != null ? `预算约 SGD ${profile.averageBudget}` : '暂无预算数据'}
        {intel.appointmentContext
          ? ` · 预约：${intel.appointmentContext.styleTitle}（${formatAppointment(intel.appointmentContext.startAt)}）`
          : ''}
      </p>

      {intel.recommendations.length > 0 ? (
        <div className="intel-reco-list">
          <p className="section-eyebrow">推荐发送</p>
          {intel.recommendations.map(({ style, reasonText }) => (
            <div key={style.id} className="intel-reco-row">
              <img className="intel-reco-thumb" src={style.imageUrl} alt={style.title} loading="lazy" />
              <div className="intel-reco-body">
                <p className="intel-reco-title">{style.title}</p>
                <p className="intel-reco-reason">{reasonText}</p>
              </div>
              <button
                type="button"
                className="button button-secondary button-compact"
                disabled={sent.has(style.id)}
                onClick={() => void send(style.id)}
              >
                {sent.has(style.id) ? '已发送 ✓' : '发送'}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
