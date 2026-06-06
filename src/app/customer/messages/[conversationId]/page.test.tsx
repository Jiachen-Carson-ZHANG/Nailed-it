import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import CustomerConversationPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/customer/messages/conv-melissa'
}));

describe('CustomerConversationPage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders the selected customer chat room', async () => {
    render(
      await CustomerConversationPage({
        params: Promise.resolve({ conversationId: 'conv-melissa' })
      })
    );

    expect(await screen.findByRole('heading', { name: /nailed-it studio/i })).toBeInTheDocument();
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
      await screen.findByRole('textbox', { name: /message/i }),
      'Can I arrive 10 minutes early?'
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/arrive 10 minutes early/i)).toBeInTheDocument();
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

    expect(await screen.findByText(/conversation not found/i)).toBeInTheDocument();
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

    expect(await screen.findByText(/conversation not found/i)).toBeInTheDocument();
  });
});
