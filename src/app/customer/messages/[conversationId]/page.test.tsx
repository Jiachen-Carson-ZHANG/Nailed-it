import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CustomerConversationPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/messages/conv-merchant'
}));

describe('CustomerConversationPage', () => {
  it('renders the selected customer chat room', async () => {
    render(
      await CustomerConversationPage({
        params: Promise.resolve({ conversationId: 'conv-merchant' })
      })
    );

    expect(screen.getByRole('heading', { name: /nailed-it studio/i })).toBeInTheDocument();
    expect(screen.getByText(/can the rhinestones be a little more subtle/i)).toBeInTheDocument();
    expect(
      screen.getByText(/reduce the crystal count and keep the placement near the ring finger only/i)
    ).toBeInTheDocument();
  });

  it('shows an empty state when the conversation id is unknown', async () => {
    render(
      await CustomerConversationPage({
        params: Promise.resolve({ conversationId: 'missing-thread' })
      })
    );

    expect(screen.getByText(/conversation not found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to messages/i })).toHaveAttribute(
      'href',
      '/customer/messages'
    );
  });
});
