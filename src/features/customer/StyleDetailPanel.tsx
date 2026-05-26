import Link from 'next/link';
import type { AIRecognitionResult, NailStyleCard } from '@/domain/nail';
import type { MockRouteIntent } from '@/domain/session';
import { Tooltip } from '@/components/ui/Tooltip';

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
        <div className="detail-final-quote">
          <strong>${style.previewQuote.price}</strong>
          <p>{style.previewQuote.duration} min · final price</p>
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
          <Link className="button button-primary" href={bookingIntent.href}>
            {bookingIntent.label}
          </Link>
        ) : (
          <section className="detail-flow-note" aria-label={bookingIntent.label}>
            <strong>{bookingIntent.label}</strong>
            <p>{bookingIntent.note}</p>
          </section>
        )}
        <Link className="button button-ghost" href={backHref}>
          Back to discovery
        </Link>
      </div>
    </article>
  );
}
