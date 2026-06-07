'use client';

import { useEffect, useState } from 'react';
import {
  getCustomerIntelligenceAction,
  recordRecommendedStyleAction,
  type CustomerIntelResult,
} from '@/lib/actions/customer-intel-actions';
import { isGenericTag } from '@/domain/catalog-tags';

const STATUS_ZH: Record<string, string> = {
  confirmed: '已确认',
  pending_review: '待确认',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
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
  const appt = intel.appointmentContext;
  // Show distinctive taste tags, not generic descriptors (亮面 / 日常通勤 / 果冻感).
  const prefTags = profile.topTags.filter((t) => !isGenericTag(t)).slice(0, 6);

  async function send(styleId: string) {
    setSent((prev) => new Set(prev).add(styleId));
    await recordRecommendedStyleAction({ customerId: profile.customerId, styleId });
  }

  return (
    <section className="detail-surface intel-panel" aria-label={`顾客画像 ${customerName}`}>
      <div className="detail-surface-header">
        <h2>顾客画像</h2>
        <span className="insights-badge">Nailed AI</span>
      </div>

      <p className="intel-name">{customerName}</p>

      {prefTags.length > 0 ? (
        <>
          <p className="intel-section-label">风格偏好</p>
          <div className="intel-chip-row">
            {prefTags.map((tag) => (
              <span key={tag} className="intel-chip">{tag}</span>
            ))}
          </div>
        </>
      ) : null}

      <div className="intel-stat-row">
        <div className="intel-stat">
          <span>预算</span>
          <strong>{profile.averageBudget != null ? `SGD ${profile.averageBudget}` : '—'}</strong>
        </div>
        <div className="intel-stat">
          <span>互动</span>
          <strong>{profile.eventCount} 次</strong>
        </div>
      </div>

      {appt ? (
        <div className="intel-appointment">
          <div className="intel-appointment-head">
            <span aria-hidden>📅</span>
            <strong>预约详情</strong>
            <span className={`intel-appt-status intel-appt-status-${appt.status}`}>
              {STATUS_ZH[appt.status] ?? appt.status}
            </span>
          </div>
          <p className="intel-appointment-style">{appt.styleTitle}</p>
          <div className="intel-appointment-grid">
            <div><span>日期</span><strong>{fmtDate(appt.startAt)}</strong></div>
            <div><span>时间</span><strong>{fmtTime(appt.startAt)}</strong></div>
          </div>
        </div>
      ) : null}

      {intel.recommendations.length > 0 ? (
        <>
          <p className="intel-section-label">推荐发送</p>
          <div className="intel-reco-list">
            {intel.recommendations.map(({ style, reasonCodes, reasonText }) => {
              const tags = reasonCodes.filter((c) => c.startsWith('tag:')).map((c) => c.slice(4));
              const reason = tags.length > 0 ? `匹配 ${tags.join(' · ')}` : reasonText;
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
                  onClick={() => void send(style.id)}
                >
                  {sent.has(style.id) ? '已发送 ✓' : '发送'}
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
