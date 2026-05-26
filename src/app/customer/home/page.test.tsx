import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CustomerHomePage from './page';
import * as stylesModule from '@/mock/styles';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/home'
}));

describe('CustomerHomePage', () => {
  it('renders the shared mobile shell with all trending styles', () => {
    render(<CustomerHomePage />);

    expect(
      screen.getByRole('heading', {
        name: /discover trending nail looks/i
      })
    ).toBeInTheDocument();

    for (const style of stylesModule.getTrendingStyles()) {
      expect(
        screen.getByRole('link', {
          name: new RegExp(style.title, 'i')
        })
      ).toHaveAttribute('href', `/customer/style/${style.id}`);
    }
  });

  it('renders an empty state instead of invalid stats when no styles are available', () => {
    vi.spyOn(stylesModule, 'getTrendingStyles').mockReturnValueOnce([]);

    render(<CustomerHomePage />);

    expect(screen.getByText(/no trending styles right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/Infinity|-Infinity/)).not.toBeInTheDocument();
  });
});
