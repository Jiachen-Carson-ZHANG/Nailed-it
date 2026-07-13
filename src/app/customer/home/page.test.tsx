import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CustomerHomePage from './page';
import { mockMerchantStyles } from '@/mock/merchant-styles';
import { demoMerchantId } from '@/mock/merchants';
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

  it('fronts the studio\'s own styles (not other merchants)', async () => {
    renderPage();

    // The feed is scoped to the demo studio's own styles (real photos + breakdowns). Other seeded
    // merchants exist for the 选品/trend agent but must not front the customer surface.
    const ownStyles = mockMerchantStyles.filter((style) => style.merchantId === demoMerchantId);
    for (const style of ownStyles) {
      expect(
        await screen.findByRole('link', {
          name: new RegExp(style.title, 'i')
        })
      ).toHaveAttribute('href', `/customer/style/${style.id}`);
    }

    // A filler (other-merchant) style must NOT appear in the feed.
    const filler = mockMerchantStyles.find((style) => style.merchantId !== demoMerchantId);
    if (filler) {
      expect(screen.queryByRole('link', { name: new RegExp(filler.title, 'i') })).not.toBeInTheDocument();
    }
  });

  it('renders without non-finite values while styles load', async () => {
    renderPage();

    expect(screen.queryByText(/Infinity|-Infinity/)).not.toBeInTheDocument();
    await screen.findByRole('link', { name: /Rose cat-eye/i });
  });
});
