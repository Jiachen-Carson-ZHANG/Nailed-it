import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import MerchantConversationPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/merchant/messages/conv-rachel'
}));

describe('MerchantConversationPage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders the merchant chat room for the selected thread', async () => {
    render(
      await MerchantConversationPage({
        params: Promise.resolve({ conversationId: 'conv-rachel' })
      })
    );

    expect(await screen.findByRole('heading', { name: /rachel goh/i })).toBeInTheDocument();
    expect(screen.getByText(/appointment pending review for tomorrow 15:30 with mei chen/i)).toBeInTheDocument();
  });

  it('lets the merchant reply as the current sender', async () => {
    const user = userEvent.setup();

    render(
      await MerchantConversationPage({
        params: Promise.resolve({ conversationId: 'conv-rachel' })
      })
    );

    await user.type(await screen.findByRole('textbox', { name: /message/i }), 'I can hold the 6pm slot.');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(await screen.findByText(/hold the 6pm slot/i)).toBeInTheDocument();
    expect(screen.getByText(/hold the 6pm slot/i).closest('article')).toHaveClass(
      'chat-message-me'
    );
  });
});
