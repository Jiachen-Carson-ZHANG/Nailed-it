import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CustomerHomePage from './page';
import { mockMerchantStyles } from '@/mock/merchant-styles';
import { SavedStylesProvider } from '@/features/customer/SavedStylesContext';
import { LanguageProvider } from '@/i18n/context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/customer/home'
}));

describe('CustomerHomePage', () => {
  function renderPage() {
    return render(
      <LanguageProvider initialLanguage="zh-CN" role="customer">
        <SavedStylesProvider>
          <CustomerHomePage />
        </SavedStylesProvider>
      </LanguageProvider>
    );
  }

  it('renders the discovery feed with published merchant styles and the upload CTA', async () => {
    renderPage();

    expect(screen.getByRole('link', { name: '新的美甲设计' })).toHaveAttribute(
      'href',
      '/customer/booking'
    );

    for (const style of mockMerchantStyles) {
      expect(
        await screen.findByRole('link', {
          name: new RegExp(style.title, 'i')
        })
      ).toHaveAttribute('href', `/customer/style/${style.id}`);
    }
  });

  it('renders without non-finite values while styles load', async () => {
    renderPage();

    expect(screen.queryByText(/Infinity|-Infinity/)).not.toBeInTheDocument();
    await screen.findByRole('link', { name: /Rose cat-eye/i });
  });
});
