'use client';

import type { MerchantPricingSetting } from '@/domain/merchant';

type GlossaryEntryCardProps = {
  settings: MerchantPricingSetting;
  onChange: (settings: MerchantPricingSetting) => void;
};

export function GlossaryEntryCard({ settings, onChange }: GlossaryEntryCardProps) {
  const baseId = `catalog-entry-${settings.id}`;

  return (
    <article className="pricing-card">
      <label className="pricing-card-toggle" htmlFor={`${baseId}-enabled`}>
        <span>{settings.nameZh}</span>
        <input
          checked={settings.enabled}
          id={`${baseId}-enabled`}
          type="checkbox"
          onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
        />
      </label>
      <div className="pricing-fields">
        <label htmlFor={`${baseId}-price`}>
          <span>SGD</span>
          <input
            aria-label={`${settings.nameZh} 单价 (SGD)`}
            id={`${baseId}-price`}
            min="0"
            step="0.5"
            type="number"
            value={settings.price}
            onChange={(event) => onChange({ ...settings, price: Number(event.target.value) })}
          />
        </label>
        <label htmlFor={`${baseId}-duration`}>
          <span>分钟</span>
          <input
            aria-label={`${settings.nameZh} 时长 (分钟)`}
            id={`${baseId}-duration`}
            max="180"
            min="0"
            type="range"
            value={settings.duration}
            onChange={(event) => onChange({ ...settings, duration: Number(event.target.value) })}
          />
          <strong>{settings.duration} min</strong>
        </label>
      </div>
    </article>
  );
}
