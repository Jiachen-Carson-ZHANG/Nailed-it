'use client';

import type { MerchantPricingSetting } from '@/domain/merchant';
import { useLanguage } from '@/i18n/context';
import { formatDuration } from '@/i18n/format';

type GlossaryEntryCardProps = {
  settings: MerchantPricingSetting;
  onChange: (settings: MerchantPricingSetting) => void;
};

export function GlossaryEntryCard({ settings, onChange }: GlossaryEntryCardProps) {
  const { language, t } = useLanguage();
  const baseId = `catalog-entry-${settings.id}`;
  const displayName = language === 'zh-CN' ? settings.name.zh : settings.name.en;

  return (
    <article className="pricing-card">
      <label className="pricing-card-toggle" htmlFor={`${baseId}-enabled`}>
        <span>{displayName}</span>
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
            aria-label={`${displayName} ${t('common.price')} (SGD)`}
            id={`${baseId}-price`}
            min="0"
            step="0.5"
            type="number"
            value={settings.price}
            onChange={(event) => onChange({ ...settings, price: Number(event.target.value) })}
          />
        </label>
        <label htmlFor={`${baseId}-duration`}>
          <span>{t('common.minutes')}</span>
          <input
            aria-label={`${displayName} ${t('common.duration')} (${t('common.minutes')})`}
            id={`${baseId}-duration`}
            max="180"
            min="0"
            type="range"
            value={settings.duration}
            onChange={(event) => onChange({ ...settings, duration: Number(event.target.value) })}
          />
          <strong>{formatDuration({ minutes: settings.duration, language })}</strong>
        </label>
      </div>
    </article>
  );
}
