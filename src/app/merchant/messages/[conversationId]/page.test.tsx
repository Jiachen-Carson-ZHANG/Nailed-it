import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import MerchantConversationPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/messages/conv-rachel'
}));

describe('MerchantConversationPage', () => {
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
});
