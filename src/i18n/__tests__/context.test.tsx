import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LanguageProvider, useLanguage } from '@/i18n/context';

function LanguageProbe() {
  const { language, role, setLanguage, t } = useLanguage();

  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="role">{role}</span>
      <span data-testid="switch-label">{t('profile.language.switch')}</span>
      <span data-testid="language-zh">{t('profile.language.zh')}</span>
      <span data-testid="language-en">{t('profile.language.en')}</span>
      <span data-testid="open-profile">{t('layout.openProfile')}</span>
      <span data-testid="new-nail-design">{t('layout.newNailDesign')}</span>
      <button type="button" onClick={() => setLanguage('en')}>
        switch
      </button>
    </div>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults customer role to zh-CN when storage is empty', () => {
    render(
      <LanguageProvider role="customer">
        <LanguageProbe />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language').textContent).toBe('zh-CN');
    expect(screen.getByTestId('switch-label').textContent).toBe('切换语言');
    expect(screen.getByTestId('language-zh').textContent).toBe('中文');
    expect(screen.getByTestId('language-en').textContent).toBe('英文');
    expect(screen.getByTestId('open-profile').textContent).toBe('打开个人资料');
    expect(screen.getByTestId('new-nail-design').textContent).toBe('新的美甲设计');
  });

  it('keeps an explicit initial language after effects settle when storage is empty', async () => {
    render(
      <LanguageProvider initialLanguage="en" role="customer">
        <LanguageProbe />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('language').textContent).toBe('en');
    });
  });

  it('exposes language, role, setLanguage, and t, and updates translations immediately when switching', () => {
    render(
      <LanguageProvider role="customer">
        <LanguageProbe />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language').textContent).toBe('zh-CN');
    expect(screen.getByTestId('role').textContent).toBe('customer');
    expect(screen.getByTestId('switch-label').textContent).toBe('切换语言');
    expect(screen.getByTestId('new-nail-design').textContent).toBe('新的美甲设计');

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));

    expect(screen.getByTestId('language').textContent).toBe('en');
    expect(screen.getByTestId('switch-label').textContent).toBe('Switch language');
    expect(screen.getByTestId('language-zh').textContent).toBe('Chinese');
    expect(screen.getByTestId('language-en').textContent).toBe('English');
    expect(screen.getByTestId('open-profile').textContent).toBe('Open profile');
    expect(screen.getByTestId('new-nail-design').textContent).toBe('New nail design');
    expect(window.localStorage.getItem('customer-language')).toBe('en');
  });

  it('reloads the stored language when the provider role changes at runtime', () => {
    window.localStorage.setItem('customer-language', 'en');
    window.localStorage.setItem('merchant-language', 'zh-CN');

    const { rerender } = render(
      <LanguageProvider role="customer">
        <LanguageProbe />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language').textContent).toBe('en');
    expect(screen.getByTestId('role').textContent).toBe('customer');

    rerender(
      <LanguageProvider role="merchant">
        <LanguageProbe />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language').textContent).toBe('zh-CN');
    expect(screen.getByTestId('role').textContent).toBe('merchant');
  });

  it('throws a clear error when useLanguage is used outside the provider', () => {
    expect(() => render(<LanguageProbe />)).toThrow('useLanguage must be used within a LanguageProvider');
  });
});
