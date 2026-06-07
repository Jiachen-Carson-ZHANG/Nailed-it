import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { resetRepositoriesForTests } from '@/lib/repositories';
import MerchantMessagesPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/merchant/messages'
}));

describe('MerchantMessagesPage', () => {
  function renderPage(language: 'zh-CN' | 'en' = 'zh-CN') {
    return render(
      <LanguageProvider initialLanguage={language} role="merchant">
        <MerchantMessagesPage />
      </LanguageProvider>
    );
  }

  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('renders merchant conversations with Chinese UI by default', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '客户消息' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /melissa tan/i })).toHaveAttribute(
      'href',
      '/merchant/messages/conv-melissa'
    );
    expect(screen.getByRole('link', { name: /rachel goh/i })).toHaveAttribute(
      'href',
      '/merchant/messages/conv-rachel'
    );
  });

  it('renders merchant conversations in English', async () => {
    renderPage('en');

    expect(screen.getByRole('heading', { name: 'Messages inbox' })).toBeInTheDocument();
    expect(screen.getByText('Review customer updates before they turn into schedule changes.')).toBeInTheDocument();
    expect(await screen.findByText('Replies post live to both sides of the thread.')).toBeInTheDocument();
  });
});
