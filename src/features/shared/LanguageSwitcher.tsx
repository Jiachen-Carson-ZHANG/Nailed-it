'use client';

import { useLanguage } from '@/i18n/context';

// Compact top-bar language toggle: one tap flips between Chinese and English.
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const next = language === 'zh-CN' ? 'en' : 'zh-CN';
  const currentLabel = language === 'zh-CN' ? '中' : 'EN';

  return (
    <button
      aria-label={t('profile.language.switch')}
      className="top-bar-lang"
      onClick={() => setLanguage(next)}
      title={t('profile.language.switch')}
      type="button"
    >
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
      <span className="top-bar-lang-label">{currentLabel}</span>
    </button>
  );
}
