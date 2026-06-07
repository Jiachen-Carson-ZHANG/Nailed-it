import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { resetRepositoriesForTests } from '@/lib/repositories';
import CustomerMessagesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/customer/messages'
}));

describe('CustomerMessagesPage', () => {
  function renderPage(language: 'zh-CN' | 'en' = 'zh-CN') {
    return render(
      <LanguageProvider initialLanguage={language} role="customer">
        <CustomerMessagesPage />
      </LanguageProvider>
    );
  }

  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders the customer conversation list in Chinese by default', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '预约消息' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /nailed-it studio/i })).toHaveAttribute(
      'href',
      '/customer/messages/conv-melissa'
    );
    expect(screen.getAllByRole('link', { name: /nailed-it studio/i })).toHaveLength(1);
    expect(screen.getAllByText(/today 14:00/i)).toHaveLength(2);
    expect(screen.queryByText(/today 16:00/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tomorrow 15:30/i)).not.toBeInTheDocument();
  });

  it('renders the customer messages page in English', async () => {
    renderPage('en');

    expect(screen.getByRole('heading', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.getByText('Stay aligned with your merchant before the appointment starts.')).toBeInTheDocument();
    expect(await screen.findByText('New replies from your studio appear here automatically.')).toBeInTheDocument();
  });
});
