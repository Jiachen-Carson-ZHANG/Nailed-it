import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import CustomerMessagesPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/messages'
}));

describe('CustomerMessagesPage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders the customer conversation list read from the conversation service', async () => {
    render(<CustomerMessagesPage />);

    expect(screen.getByRole('heading', { name: /messages/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /nailed-it studio/i })).toHaveAttribute(
      'href',
      '/customer/messages/conv-melissa'
    );
    expect(screen.getAllByRole('link', { name: /nailed-it studio/i })).toHaveLength(1);
    expect(screen.getAllByText(/today 14:00/i)).toHaveLength(2);
    expect(screen.queryByText(/today 16:00/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tomorrow 15:30/i)).not.toBeInTheDocument();
  });
});
