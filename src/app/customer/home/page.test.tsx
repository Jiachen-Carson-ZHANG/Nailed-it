import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CustomerHomePage from './page';
import { mockMerchantStyles } from '@/mock/merchant-styles';
import { SavedStylesProvider } from '@/features/customer/SavedStylesContext';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/home'
}));

describe('CustomerHomePage', () => {
  function renderPage() {
    return render(
      <SavedStylesProvider>
        <CustomerHomePage />
      </SavedStylesProvider>
    );
  }

  it('renders the discovery feed with published merchant styles and the upload CTA', async () => {
    renderPage();

    expect(screen.getByRole('link', { name: /new nail design/i })).toHaveAttribute(
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
    await screen.findByRole('link', { name: /Rose Cat Eye Shine/i });
  });
});
