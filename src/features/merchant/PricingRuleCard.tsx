'use client';

import type { PricingItem } from '@/domain/nail';

type PricingRuleCardProps = {
  item: PricingItem;
  label: string;
  onChange: (item: PricingItem) => void;
};

export function PricingRuleCard({ item, label, onChange }: PricingRuleCardProps) {
  const baseId = `pricing-rule-${item.id}`;

  return (
    <article className="pricing-card">
      <label className="pricing-card-toggle" htmlFor={`${baseId}-enabled`}>
        <span>{label}</span>
        <input
          checked={item.enabled}
          id={`${baseId}-enabled`}
          type="checkbox"
          onChange={(event) => onChange({ ...item, enabled: event.target.checked })}
        />
      </label>
      <div className="pricing-fields">
        <label htmlFor={`${baseId}-price`}>
          <span>¥</span>
          <input
            aria-label={`${label} price (¥)`}
            id={`${baseId}-price`}
            min="0"
            type="number"
            value={item.price}
            onChange={(event) => onChange({ ...item, price: Number(event.target.value) })}
          />
        </label>
        <label htmlFor={`${baseId}-duration`}>
          <span>Minutes</span>
          <input
            aria-label={`${label} duration (minutes)`}
            id={`${baseId}-duration`}
            max="180"
            min="0"
            type="range"
            value={item.duration}
            onChange={(event) => onChange({ ...item, duration: Number(event.target.value) })}
          />
          <strong>{item.duration} min</strong>
        </label>
      </div>
    </article>
  );
}
