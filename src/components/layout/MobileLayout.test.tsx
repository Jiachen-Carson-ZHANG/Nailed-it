import { render, screen } from '@testing-library/react';
import { MobileLayout } from './MobileLayout';

describe('MobileLayout', () => {
  it('renders a clickable brand logo in the top bar for customer pages', () => {
    render(
      <MobileLayout role="customer" showTabs={false} title="Nailed-it">
        <div>Customer page</div>
      </MobileLayout>
    );

    const brandLink = screen.getByRole('link', { name: 'Nailed-it' });

    expect(brandLink).toHaveAttribute('href', '/customer/home');
    expect(screen.getByRole('img', { name: 'Nailed-it' })).toBeInTheDocument();
  });
});
