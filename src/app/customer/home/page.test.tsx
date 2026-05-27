import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CustomerHomePage from './page';
import * as stylesModule from '@/mock/styles';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/home'
}));

describe('CustomerHomePage', () => {
  it('renders the discovery feed with all trending styles and the upload CTA', () => {
    render(<CustomerHomePage />);

    expect(screen.getByRole('link', { name: /new nail design/i })).toHaveAttribute(
      'href',
      '/customer/booking'
    );

    for (const style of stylesModule.getTrendingStyles()) {
      expect(
        screen.getByRole('link', {
          name: new RegExp(style.title, 'i')
        })
      ).toHaveAttribute('href', `/customer/style/${style.id}`);
    }
  });

  it('renders gracefully when no styles are available', () => {
    vi.spyOn(stylesModule, 'getTrendingStyles').mockReturnValueOnce([]);

    render(<CustomerHomePage />);

    expect(screen.queryByText(/Infinity|-Infinity/)).not.toBeInTheDocument();
  });
});
