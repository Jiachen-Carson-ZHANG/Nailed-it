import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import MerchantProfilePage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/profile'
}));

describe('MerchantProfilePage', () => {
  it('renders merchant analytics and management shortcuts', () => {
    render(<MerchantProfilePage />);

    expect(screen.getByRole('heading', { name: /studio profile/i })).toBeInTheDocument();
    expect(screen.getByText(/appointments this week/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open pricing rules/i })).toHaveAttribute(
      'href',
      '/merchant/manage'
    );
  });
});
