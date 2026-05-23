import Link from 'next/link';
import type { AIRecognitionResult, NailStyleCard } from '@/domain/nail';

type StyleDetailPanelProps = {
  recognition: AIRecognitionResult;
  style: NailStyleCard;
};

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function StyleDetailPanel({ recognition, style }: StyleDetailPanelProps) {
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
          <h2 id="style-detail-pricing-title">Pricing snapshot</h2>
          <span className="detail-confidence">AI confidence {formatConfidence(recognition.meta.confidence)}</span>
        </div>
        <div className="detail-quote-grid">
          <div className="detail-quote-card">
            <span>Preview quote</span>
            <strong>${style.previewQuote.price}</strong>
            <p>{style.previewQuote.duration} min based on current pricing rules</p>
          </div>
          <div className="detail-quote-card">
            <span>AI suggestion</span>
            <strong>${recognition.meta.aiSuggestedQuote.price}</strong>
            <p>{recognition.meta.aiSuggestedQuote.duration} min from the recognition result</p>
          </div>
        </div>
      </section>

      <section className="detail-surface" aria-labelledby="style-detail-selection-title">
        <div className="detail-surface-header">
          <h2 id="style-detail-selection-title">Recognized attributes</h2>
          <span className="detail-popularity">Popularity {style.popularityScore}</span>
        </div>
        <div className="detail-selection-list">
          {selectionGroups.map((group) => (
            <div key={group.label} className="detail-selection-group">
              <span>{group.label}</span>
              <div className="style-tag-row">
                {group.values.map((value) => (
                  <span key={value} className="style-tag">
                    {value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="detail-actions">
        <Link className="button button-primary" href="/customer/home">
          Back to discovery
        </Link>
        <button className="button button-secondary" disabled type="button">
          Booking opens in the next flow
        </button>
      </div>
    </article>
  );
}
