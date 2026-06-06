import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import MerchantStylesPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/styles',
}));

describe('MerchantStylesPage', () => {
  it('shows upload controls and the merchant collection', async () => {
    render(<MerchantStylesPage />);

    expect(screen.getByRole('heading', { name: /style library/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload for review/i })).toBeInTheDocument();
    expect(await screen.findByText('Rose Cat Eye Shine')).toBeInTheDocument();
  });
});
