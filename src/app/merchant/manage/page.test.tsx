'use client';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import MerchantManagePage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/manage'
}));

describe('MerchantManagePage', () => {
  it('renders pricing sections and shows a toast after saving changes', async () => {
    const user = userEvent.setup();

    render(<MerchantManagePage />);

    expect(
      screen.getByRole('heading', {
        name: /configure estimate rules/i
      })
    ).toBeInTheDocument();

    const removalPriceInput = screen.getByLabelText(/removal price/i);
    await user.clear(removalPriceInput);
    await user.type(removalPriceInput, '12');
    await user.click(screen.getByRole('button', { name: /save price list/i }));

    expect(screen.getByRole('status')).toHaveTextContent(/price list updated for customer estimates/i);
  });
});
