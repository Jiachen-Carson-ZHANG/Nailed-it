import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CustomerHomePage from './page';
import * as stylesModule from '@/mock/styles';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/home'
}));

describe('CustomerHomePage', () => {
  it('renders the customer home filters and all trending styles', () => {
    render(<CustomerHomePage />);

    expect(screen.getByRole('heading', { name: /styles/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /price range/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all styles/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('20')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('100')).toBeInTheDocument();

    for (const style of stylesModule.getTrendingStyles()) {
      expect(
        screen.getByRole('link', {
          name: new RegExp(style.title, 'i')
        })
      ).toHaveAttribute('href', `/customer/style/${style.id}`);
    }
  });

  it('filters styles by style tag selection', async () => {
    const user = userEvent.setup();

    render(<CustomerHomePage />);

    await user.click(screen.getByRole('button', { name: /all styles/i }));
    await user.click(screen.getByRole('checkbox', { name: /chrome/i }));

    expect(screen.getByRole('link', { name: /chrome mirror almond/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /rose cat eye shine/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /soft studio french/i })).not.toBeInTheDocument();
  });

  it('filters styles by entered minimum and maximum price', async () => {
    const user = userEvent.setup();

    render(<CustomerHomePage />);

    const minimumInput = screen.getByPlaceholderText('20');
    const maximumInput = screen.getByPlaceholderText('100');

    await user.type(minimumInput, '40');
    await user.type(maximumInput, '60');

    expect(screen.getByRole('link', { name: /soft studio french/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /chrome mirror almond/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /clean daily solid/i })).not.toBeInTheDocument();
  });

  it('renders an empty state instead of invalid stats when no styles are available', () => {
    vi.spyOn(stylesModule, 'getTrendingStyles').mockReturnValueOnce([]);

    render(<CustomerHomePage />);

    expect(screen.getByText(/no styles are trending yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Infinity|-Infinity/)).not.toBeInTheDocument();
  });
});
