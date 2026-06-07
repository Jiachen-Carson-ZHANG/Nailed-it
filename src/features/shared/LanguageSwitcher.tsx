'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import type { AppLanguage } from '@/i18n/types';
import { useLanguage } from '@/i18n/context';

const languageOptions: AppLanguage[] = ['zh-CN', 'en'];

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const currentLanguageLabel = language === 'zh-CN' ? t('profile.language.zh') : t('profile.language.en');

  function handleLanguageSelect(option: AppLanguage) {
    setLanguage(option);
    // 中文注释：切换语言后立即收起，保证两端 profile 页交互一致。
    setOpen(false);
    // 中文注释：选择项点击后把焦点还给触发按钮，避免焦点丢到已折叠的选项区域。
    triggerButtonRef.current?.focus();
  }

  function handleRadioKeyDown(option: AppLanguage, event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = languageOptions.indexOf(option);

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      // 中文注释：方向键前进时循环到下一个语言，保证未选项可被纯键盘访问。
      handleLanguageSelect(languageOptions[(currentIndex + 1) % languageOptions.length]);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      // 中文注释：方向键后退时循环到上一个语言，符合 radiogroup 的常见键盘模型。
      handleLanguageSelect(
        languageOptions[(currentIndex - 1 + languageOptions.length) % languageOptions.length]
      );
    }
  }

  return (
    <section aria-label={t('profile.language.switch')} className="profile-section">
      <button
        aria-expanded={open}
        aria-label={t('profile.language.switch')}
        className="button button-secondary button-block"
        onClick={() => setOpen((value) => !value)}
        ref={triggerButtonRef}
        type="button"
      >
        {currentLanguageLabel}
      </button>
      {open ? (
        <div aria-label={t('profile.language.switch')} className="profile-section" role="radiogroup">
          {languageOptions.map((option) => {
            const label = option === 'zh-CN' ? t('profile.language.zh') : t('profile.language.en');
            const active = language === option;

            return (
              <button
                key={option}
                aria-checked={active}
                className={
                  active
                    ? 'button button-primary button-block'
                    : 'button button-secondary button-block'
                }
                onClick={() => handleLanguageSelect(option)}
                onKeyDown={(event) => handleRadioKeyDown(option, event)}
                role="radio"
                tabIndex={active ? 0 : -1}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
