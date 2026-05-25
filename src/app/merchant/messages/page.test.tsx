import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { resetOperationsStoreForTests } from '@/mock/operations-store';
import MerchantMessagesPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/messages'
}));

describe('MerchantMessagesPage', () => {
  beforeEach(() => {
    resetOperationsStoreForTests();
  });

  it('renders merchant conversations with booking context', () => {
    render(<MerchantMessagesPage />);

    expect(screen.getByRole('heading', { name: /messages inbox/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /melissa tan/i })).toHaveAttribute(
      'href',
      '/merchant/messages/conv-melissa'
    );
    expect(screen.getByRole('link', { name: /rachel goh/i })).toHaveAttribute(
      'href',
      '/merchant/messages/conv-rachel'
    );
  });
});
