import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LanguageProvider, useLanguage } from '@/i18n/context';

function LanguageProbe() {
  const { language, role, setLanguage } = useLanguage();

  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="role">{role}</span>
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

  it('exposes language, role, and setLanguage, and updates immediately when switching', () => {
    render(
      <LanguageProvider role="customer">
        <LanguageProbe />
      </LanguageProvider>
    );

    expect(screen.getByTestId('language').textContent).toBe('zh-CN');
    expect(screen.getByTestId('role').textContent).toBe('customer');

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));

    expect(screen.getByTestId('language').textContent).toBe('en');
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
