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
    expect(screen.getAllByRole('link', { name: /nailed-it studio/i })[0]).toHaveAttribute(
      'href',
      '/customer/messages/conv-melissa'
    );
    expect(screen.getByText(/today 14:00/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/2 unread/i)).toBeInTheDocument();
  });
});
