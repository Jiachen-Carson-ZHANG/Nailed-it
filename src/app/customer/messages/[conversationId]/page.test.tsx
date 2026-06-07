import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { resetRepositoriesForTests } from '@/lib/repositories';
import CustomerConversationPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/customer/messages/conv-melissa'
}));

describe('CustomerConversationPage', () => {
  async function renderPage(
    conversationId: string,
    language: 'zh-CN' | 'en' = 'zh-CN'
  ) {
    return render(
      <LanguageProvider initialLanguage={language} role="customer">
        {await CustomerConversationPage({
          params: Promise.resolve({ conversationId })
        })}
      </LanguageProvider>
    );
  }

  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders the selected customer chat room', async () => {
    await renderPage('conv-melissa');

    expect(await screen.findByRole('heading', { name: /nailed-it studio/i })).toBeInTheDocument();
    expect(screen.getByText('对话')).toBeInTheDocument();
    expect(screen.getByText(/appointment confirmed for today 14:00 with mei chen/i)).toBeInTheDocument();
  });

  it('lets the customer send a demo message into the booking thread', async () => {
    const user = userEvent.setup();

    await renderPage('conv-melissa');

    await user.type(
      await screen.findByRole('textbox', { name: '消息内容' }),
      'Can I arrive 10 minutes early?'
    );
    await user.click(screen.getByRole('button', { name: '发送' }));

    expect(await screen.findByText(/arrive 10 minutes early/i)).toBeInTheDocument();
    expect(screen.getByText(/arrive 10 minutes early/i).closest('article')).toHaveClass(
      'chat-message-me'
    );
  });

  it('shows an empty state when the conversation id is unknown', async () => {
    await renderPage('missing-thread');

    expect(await screen.findByText('未找到该对话')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回消息列表' })).toHaveAttribute(
      'href',
      '/customer/messages'
    );
  });

  it('does not let the customer open another customer appointment thread directly', async () => {
    await renderPage('conv-amy');

    expect(await screen.findByText('未找到该对话')).toBeInTheDocument();
  });

  it('renders customer conversation actions in English', async () => {
    await renderPage('conv-melissa', 'en');

    expect(await screen.findByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to messages' })).toHaveAttribute(
      'href',
      '/customer/messages'
    );
  });
});
