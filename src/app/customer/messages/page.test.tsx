import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CustomerMessagesPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/messages'
}));

describe('CustomerMessagesPage', () => {
  it('renders the customer conversation list from the shared mock source', () => {
    render(<CustomerMessagesPage />);

    expect(screen.getByRole('heading', { name: /messages/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nailed-it studio/i })).toHaveAttribute(
      'href',
      '/customer/messages/conv-merchant'
    );
    expect(screen.getByText(/today 14:00/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
