import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { resetOperationsStoreForTests } from '@/mock/operations-store';
import CustomerMessagesPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/messages'
}));

describe('CustomerMessagesPage', () => {
  beforeEach(() => {
    resetOperationsStoreForTests();
  });

  it('renders the customer conversation list from the shared mock source', () => {
    render(<CustomerMessagesPage />);

    expect(screen.getByRole('heading', { name: /messages/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /nailed-it studio/i })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /nailed-it studio/i })).toHaveAttribute(
      'href',
      '/customer/messages/conv-melissa'
    );
    expect(screen.getAllByText(/today 14:00/i)).toHaveLength(2);
    expect(screen.queryByText(/today 16:00/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tomorrow 15:30/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/unread/i)).not.toBeInTheDocument();
  });
});
