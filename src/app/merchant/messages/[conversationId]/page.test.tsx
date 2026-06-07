import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { resetRepositoriesForTests } from '@/lib/repositories';
import MerchantConversationPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/merchant/messages/conv-rachel'
}));

describe('MerchantConversationPage', () => {
  async function renderPage(
    conversationId: string,
    language: 'zh-CN' | 'en' = 'zh-CN'
  ) {
    return render(
      <LanguageProvider initialLanguage={language} role="merchant">
        {await MerchantConversationPage({
          params: Promise.resolve({ conversationId })
        })}
      </LanguageProvider>
    );
  }

  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders the merchant chat room for the selected thread', async () => {
    await renderPage('conv-rachel');

    expect(await screen.findByRole('heading', { name: /rachel goh/i })).toBeInTheDocument();
    expect(screen.getByText(/appointment pending review for tomorrow 15:30 with mei chen/i)).toBeInTheDocument();
  });

  it('lets the merchant reply as the current sender', async () => {
    const user = userEvent.setup();

    await renderPage('conv-rachel');

    await user.type(await screen.findByRole('textbox', { name: '消息内容' }), 'I can hold the 6pm slot.');
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText(/hold the 6pm slot/i)).toBeInTheDocument();
    expect(screen.getByText(/hold the 6pm slot/i).closest('article')).toHaveClass(
      'chat-message-me'
    );
  });

  it('renders merchant conversation actions in English', async () => {
    await renderPage('conv-rachel', 'en');

    expect(await screen.findByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to messages' })).toHaveAttribute(
      'href',
      '/merchant/messages'
    );
  });
});
