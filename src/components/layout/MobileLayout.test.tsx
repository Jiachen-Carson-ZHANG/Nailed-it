import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/context';
import { MobileLayout } from './MobileLayout';

describe('MobileLayout', () => {
  it('renders a clickable brand logo in the top bar for customer pages', () => {
    render(
      <LanguageProvider initialLanguage="zh-CN" role="customer">
        <MobileLayout role="customer" showTabs={false} title="Nailed-it">
          <div>Customer page</div>
        </MobileLayout>
      </LanguageProvider>
    );

    const brandLink = screen.getByRole('link', { name: 'Nailed-it' });

    expect(brandLink).toHaveAttribute('href', '/customer/home');
    expect(screen.getByRole('img', { name: 'Nailed-it' })).toBeInTheDocument();
  });

  it('renders localized CTA and profile labels from the language context', () => {
    const { unmount } = render(
      <LanguageProvider initialLanguage="zh-CN" role="customer">
        <MobileLayout role="customer" showTabs={false} title="Nailed-it">
          <div>Customer page</div>
        </MobileLayout>
      </LanguageProvider>
    );

    expect(screen.getByRole('link', { name: '新的美甲设计' })).toHaveAttribute(
      'href',
      '/customer/booking'
    );
    expect(screen.getByRole('link', { name: '打开个人资料' })).toHaveAttribute(
      'href',
      '/customer/profile'
    );

    unmount();

    render(
      <LanguageProvider initialLanguage="en" role="customer">
        <MobileLayout role="customer" showTabs={false} title="Nailed-it">
          <div>Customer page</div>
        </MobileLayout>
      </LanguageProvider>
    );

    expect(screen.getByRole('link', { name: 'New nail design' })).toHaveAttribute(
      'href',
      '/customer/booking'
    );
    expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute(
      'href',
      '/customer/profile'
    );
  });
});
