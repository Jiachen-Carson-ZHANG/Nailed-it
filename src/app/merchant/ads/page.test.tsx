import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/context';
import MerchantAdCenterPage from './page';

describe('MerchantAdCenterPage', () => {
  function renderPage() {
    return render(
      <LanguageProvider initialLanguage="en" role="merchant">
        <MerchantAdCenterPage />
      </LanguageProvider>,
    );
  }

  it('shows overview stats and active campaigns', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /ad center/i })).toBeInTheDocument();
    expect(await screen.findByText('Rose cat-eye')).toBeInTheDocument();
    expect(screen.getByText('Creamy French')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rose cat-eye/i })).toHaveAttribute(
      'href',
      '/merchant/styles/rose-cat-eye/ads',
    );
  });
});
