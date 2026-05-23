import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CustomerHomePage from './page';
import { getTrendingStyles } from '@/mock/styles';

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

    for (const style of getTrendingStyles()) {
      expect(
        screen.getByRole('link', {
          name: new RegExp(style.title, 'i')
        })
      ).toHaveAttribute('href', `/customer/style/${style.id}`);
    }
  });
});
