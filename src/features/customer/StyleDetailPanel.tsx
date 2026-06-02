import Link from 'next/link';
import type { AIRecognitionResult, NailStyleCard, PricingItem } from '@/domain/nail';
import { pricingTargetLabels } from '@/domain/nail';
import type { MockRouteIntent } from '@/domain/session';
import { getCustomerTryOnPath } from '@/domain/session';
import { Tooltip } from '@/components/ui/Tooltip';
import { defaultPricingRules } from '@/mock/pricing';

type BreakdownRow = { label: string; price: number; duration: number };

const rulesByTarget = new Map<string, PricingItem>(
  defaultPricingRules.map((r) => [r.target, r])
);

function buildBreakdown(recognition: AIRecognitionResult): BreakdownRow[] {
  const rows: BreakdownRow[] = [];

  const candidates = [
    ...recognition.selection.baseServices,
    recognition.selection.nailShape,
    ...recognition.selection.styles,
    ...recognition.selection.addons
  ];

  for (const key of candidates) {
    const rule = rulesByTarget.get(key);
    if (rule && rule.price > 0) {
      rows.push({ label: pricingTargetLabels[key as keyof typeof pricingTargetLabels] ?? key, price: rule.price, duration: rule.duration });
    }
  }
  return rows;
}

type StyleDetailPanelProps = {
  backHref: string;
  bookingIntent: MockRouteIntent;
  recognition: AIRecognitionResult;
  style: NailStyleCard;
};

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function StyleDetailPanel({
  backHref,
  bookingIntent,
  recognition,
  style
}: StyleDetailPanelProps) {
  const breakdown = buildBreakdown(recognition);
  const breakdownTotal = breakdown.reduce((s, r) => s + r.price, 0);
  const breakdownDuration = breakdown.reduce((s, r) => s + r.duration, 0);

  const selectionGroups = [
    { label: 'Base', values: recognition.selection.baseServices },
    { label: 'Shape', values: [recognition.selection.nailShape] },
    { label: 'Style', values: recognition.selection.styles },
    { label: 'Add-ons', values: recognition.selection.addons }
  ].filter((group) => group.values.length > 0);

  return (
    <article className="style-detail-panel">
      <div className="style-detail-hero">
        <img alt={style.title} className="style-detail-image" src={style.imageUrl} />
        <div className="style-detail-summary">
          <p className="section-eyebrow">Style brief</p>
          <h1>{style.title}</h1>
          <p>{recognition.selection.otherNotes}</p>
        </div>
      </div>

      <section className="detail-surface" aria-labelledby="style-detail-pricing-title">
        <div className="detail-surface-header">
          <h2 id="style-detail-pricing-title">Your quote</h2>
          <Tooltip
            content={`AI estimated $${recognition.meta.aiSuggestedQuote.price} for ${recognition.meta.aiSuggestedQuote.duration} min based on the image. The merchant applied current pricing rules to set the final number. Match confidence: ${formatConfidence(recognition.meta.confidence)}.`}
          >
            <button type="button" className="detail-price-info" aria-label="Why this price">
              Why this price?
            </button>
          </Tooltip>
        </div>

        {breakdown.length > 0 && (
          <table className="breakdown-table" aria-label="Price breakdown">
            <tbody>
              {breakdown.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="breakdown-duration">{row.duration} min</td>
                  <td className="breakdown-price">${row.price}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="breakdown-total">
                <td>Total</td>
                <td className="breakdown-duration">{breakdownDuration} min</td>
                <td className="breakdown-price">${breakdownTotal}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <div className="detail-final-quote">
          <strong>${style.previewQuote.price}</strong>
          <p>{style.previewQuote.duration} min · merchant price</p>
        </div>
      </section>

      <section className="detail-surface" aria-labelledby="style-detail-selection-title">
        <div className="detail-surface-header">
          <h2 id="style-detail-selection-title">Style details</h2>
          <Tooltip content={`Booked by ${style.popularityScore} customers in the last 30 days.`}>
            <button type="button" className="detail-popularity-info" aria-label="What popularity means">
              ★ {style.popularityScore} bookings
            </button>
          </Tooltip>
        </div>
        <div className="detail-selection-list">
          {selectionGroups.map((group) => (
            <div key={group.label} className="detail-selection-group">
              <span>{group.label}</span>
              <div className="style-tag-row">
                {group.values.map((value) => (
                  <span key={value} className="style-tag style-tag-readonly">
                    {value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="detail-actions">
        {bookingIntent.href ? (
          <Link className="button button-primary button-block" href={bookingIntent.href}>
            {bookingIntent.label}
          </Link>
        ) : (
          <section className="detail-flow-note" aria-label={bookingIntent.label}>
            <strong>{bookingIntent.label}</strong>
            <p>{bookingIntent.note}</p>
          </section>
        )}
        <Link className="button button-ghost button-block" href={getCustomerTryOnPath(style.id)}>
          Try on this look
        </Link>
        <p className="detail-merchant-line">At <strong>Nailed-it Studio</strong> · Free cancellation up to 24 h before</p>
        <Link className="detail-back-link" href={backHref}>
          ← Back to discovery
        </Link>
      </div>
    </article>
  );
}
