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
  currency = 'SGD',
}: ManageServiceRowProps) {
  const { language, t } = useLanguage();
  const baseId = `manage-row-${entry.id}`;
  const currentUnit = settings.unit ?? entry.default_pricing_unit;
  const entryName = language === 'zh-CN' ? entry.name_zh : entry.name_en;

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
          aria-label={`${entryName} ${t('common.duration')}`}
        />
        <span>{t('common.minutes')}</span>
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
            aria-label={`${entryName} ${t('common.price')}`}
          />
          <span>{currency}</span>
        </label>
      )}
      {showUnit && (
        <select
          aria-label={`${entryName} ${t('common.unit')}`}
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
