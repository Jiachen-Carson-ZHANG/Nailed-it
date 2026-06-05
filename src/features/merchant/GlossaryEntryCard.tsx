'use client';

import type { GlossaryEntry } from '@/data/glossary';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';

type GlossaryEntryCardProps = {
  entry: GlossaryEntry;
  settings: GlossaryEntrySettings;
  onChange: (settings: GlossaryEntrySettings) => void;
};

export function GlossaryEntryCard({ entry, settings, onChange }: GlossaryEntryCardProps) {
  const baseId = `glossary-entry-${entry.id}`;

  return (
    <article className="pricing-card">
      <label className="pricing-card-toggle" htmlFor={`${baseId}-enabled`}>
        <span>{entry.name_zh}</span>
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
            aria-label={`${entry.name_zh} 单价 (SGD)`}
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
            aria-label={`${entry.name_zh} 时长 (分钟)`}
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
