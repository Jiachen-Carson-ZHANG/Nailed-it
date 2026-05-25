import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { resetOperationsStoreForTests } from '@/mock/operations-store';
import CustomerConversationPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/messages/conv-merchant'
}));

describe('CustomerConversationPage', () => {
  beforeEach(() => {
    resetOperationsStoreForTests();
  });

  it('renders the selected customer chat room', async () => {
    render(
      await CustomerConversationPage({
        params: Promise.resolve({ conversationId: 'conv-melissa' })
      })
    );

    expect(screen.getByRole('heading', { name: /nailed-it studio/i })).toBeInTheDocument();
    expect(screen.getByText(/appointment confirmed for today 14:00 with mei chen/i)).toBeInTheDocument();
  });

  it('lets the customer send a demo message into the booking thread', async () => {
    const user = userEvent.setup();

    render(
      await CustomerConversationPage({
        params: Promise.resolve({ conversationId: 'conv-melissa' })
      })
    );

    await user.type(
      screen.getByRole('textbox', { name: /message/i }),
      'Can I arrive 10 minutes early?'
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText(/arrive 10 minutes early/i)).toBeInTheDocument();
    expect(screen.getByText(/arrive 10 minutes early/i).closest('article')).toHaveClass(
      'chat-message-me'
    );
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

  it('does not let the customer open another customer appointment thread directly', async () => {
    render(
      await CustomerConversationPage({
        params: Promise.resolve({ conversationId: 'conv-amy' })
      })
    );

    expect(screen.getByText(/conversation not found/i)).toBeInTheDocument();
  });
});
