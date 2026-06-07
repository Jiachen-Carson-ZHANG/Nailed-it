'use client';

import type { GlossaryEntry } from '@/data/glossary';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import { useLanguage } from '@/i18n/context';

const UNIT_OPTIONS = {
  'zh-CN': [
    { label: '每套', value: 'per_set' },
    { label: '每指', value: 'per_finger' },
    { label: '每颗', value: 'per_piece' },
    { label: '每次', value: 'fixed' },
  ],
  en: [
    { label: 'per set', value: 'per_set' },
    { label: 'per finger', value: 'per_finger' },
    { label: 'per piece', value: 'per_piece' },
    { label: 'per visit', value: 'fixed' },
  ],
} as const;

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
  const { language } = useLanguage();
  const baseId = `manage-row-${entry.id}`;
  const currentUnit = settings.unit ?? entry.default_pricing_unit;
  const entryName = language === 'zh-CN' ? entry.name_zh : entry.name_en;
  const durationLabel = language === 'zh-CN' ? '时长' : 'duration';
  const priceLabel = language === 'zh-CN' ? '单价' : 'price';
  const unitLabel = language === 'zh-CN' ? '单位' : 'unit';
  const minuteLabel = language === 'zh-CN' ? '分钟' : 'min';

  return (
    <div className="manage-row">
      <span className="manage-row-name">{entryName}</span>
      <label className="manage-row-field" htmlFor={`${baseId}-duration`}>
        <input
          id={`${baseId}-duration`}
          type="number"
          min={0}
          max={240}
          value={settings.duration}
          onChange={(e) => onChange({ ...settings, duration: Math.max(0, Number(e.target.value) || 0) })}
          aria-label={`${entryName} ${durationLabel}`}
        />
        <span>{minuteLabel}</span>
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
            aria-label={`${entryName} ${priceLabel}`}
          />
          <span>{currency}</span>
        </label>
      )}
      {showUnit && (
        <select
          aria-label={`${entryName} ${unitLabel}`}
          value={currentUnit}
          onChange={(e) => onChange({ ...settings, unit: e.target.value })}
          className="manage-row-unit"
        >
          {UNIT_OPTIONS[language].map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
