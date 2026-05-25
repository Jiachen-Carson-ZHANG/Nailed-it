import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { resetOperationsStoreForTests } from '@/mock/operations-store';
import MerchantConversationPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/messages/conv-rachel'
}));

describe('MerchantConversationPage', () => {
  beforeEach(() => {
    resetOperationsStoreForTests();
  });

  it('renders the merchant chat room for the selected thread', async () => {
    render(
      await MerchantConversationPage({
        params: Promise.resolve({ conversationId: 'conv-rachel' })
      })
    );

    expect(screen.getByRole('heading', { name: /rachel goh/i })).toBeInTheDocument();
    expect(screen.getByText(/could i switch to the 6pm slot if it opens up/i)).toBeInTheDocument();
    expect(screen.getByText(/i will message you if the evening slot becomes available/i)).toBeInTheDocument();
  });

  it('lets the merchant reply as the current sender', async () => {
    const user = userEvent.setup();

    render(
      await MerchantConversationPage({
        params: Promise.resolve({ conversationId: 'conv-rachel' })
      })
    );

    await user.type(screen.getByRole('textbox', { name: /message/i }), 'I can hold the 6pm slot.');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText(/hold the 6pm slot/i)).toBeInTheDocument();
    expect(screen.getByText(/hold the 6pm slot/i).closest('article')).toHaveClass(
      'chat-message-me'
    );
  });
});
