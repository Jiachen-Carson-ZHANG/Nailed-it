'use client';

import type { GlossaryEntry } from '@/data/glossary';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';

const UNIT_OPTIONS: { label: string; value: string }[] = [
  { label: '每套', value: 'per_set' },
  { label: '每指', value: 'per_finger' },
  { label: '每颗', value: 'per_piece' },
  { label: '每次', value: 'fixed' },
];

type ManageServiceRowProps = {
  entry: GlossaryEntry;
  settings: GlossaryEntrySettings;
  onChange: (next: GlossaryEntrySettings) => void;
  showPrice?: boolean;
  showUnit?: boolean;
  currency?: string;
};

export function ManageServiceRow({
  entry,
  settings,
  onChange,
  showPrice = true,
  showUnit = true,
  currency = 'CNY',
}: ManageServiceRowProps) {
  const baseId = `manage-row-${entry.id}`;
  const currentUnit = settings.unit ?? entry.default_pricing_unit;

  return (
    <div className="manage-row">
      <span className="manage-row-name">{entry.name_zh}</span>
      <label className="manage-row-field" htmlFor={`${baseId}-duration`}>
        <input
          id={`${baseId}-duration`}
          type="number"
          min={0}
          max={240}
          value={settings.duration}
          onChange={(e) => onChange({ ...settings, duration: Math.max(0, Number(e.target.value) || 0) })}
          aria-label={`${entry.name_zh} 时长`}
        />
        <span>分钟</span>
      </label>
      {showPrice && (
        <label className="manage-row-field" htmlFor={`${baseId}-price`}>
          <input
            id={`${baseId}-price`}
            type="number"
            min={0}
            step={0.5}
            value={settings.price}
            onChange={(e) => onChange({ ...settings, price: Math.max(0, Number(e.target.value) || 0) })}
            aria-label={`${entry.name_zh} 单价`}
          />
          <span>{currency}</span>
        </label>
      )}
      {showUnit && (
        <select
          aria-label={`${entry.name_zh} 单位`}
          value={currentUnit}
          onChange={(e) => onChange({ ...settings, unit: e.target.value })}
          className="manage-row-unit"
        >
          {UNIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
