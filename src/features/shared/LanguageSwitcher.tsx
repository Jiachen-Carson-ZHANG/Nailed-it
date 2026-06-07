'use client';

import type { AppLanguage } from '@/i18n/types';
import { useLanguage } from '@/i18n/context';

const languageOptions: AppLanguage[] = ['zh-CN', 'en'];

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <section aria-label={t('profile.language.switch')} className="profile-section">
      <p className="profile-stat-label">{t('profile.language.switch')}</p>
      <div aria-label={t('profile.language.switch')} role="group">
        {languageOptions.map((option) => {
          const label = option === 'zh-CN' ? t('profile.language.zh') : t('profile.language.en');
          const active = language === option;

          return (
            <button
              key={option}
              aria-pressed={active}
              className={active ? 'button button-primary' : 'button button-secondary'}
              onClick={() => setLanguage(option)}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
