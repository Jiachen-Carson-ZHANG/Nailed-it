import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import MerchantMessagesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/merchant/messages'
}));

describe('MerchantMessagesPage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders merchant conversations with booking context', async () => {
    render(<MerchantMessagesPage />);

    expect(screen.getByRole('heading', { name: /messages inbox/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /melissa tan/i })).toHaveAttribute(
      'href',
      '/merchant/messages/conv-melissa'
    );
    expect(screen.getByRole('link', { name: /rachel goh/i })).toHaveAttribute(
      'href',
      '/merchant/messages/conv-rachel'
    );
  });
});
