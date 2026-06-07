import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { resetRepositoriesForTests } from '@/lib/repositories';
import MerchantProfilePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/merchant/profile'
}));

describe('MerchantProfilePage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
    window.localStorage.clear();
  });

  function renderMerchantProfilePage() {
    return render(
      <LanguageProvider role="merchant">
        <MerchantProfilePage />
      </LanguageProvider>
    );
  }

  it('renders merchant analytics and management shortcuts (workload read from the DB)', async () => {
    renderMerchantProfilePage();

    expect(screen.getByRole('heading', { name: '门店资料' })).toBeInTheDocument();
    expect(screen.getByText('本周预约')).toBeInTheDocument();
    expect(screen.getByText('技师工作负载')).toBeInTheDocument();
    expect(screen.getByText('Mei Chen')).toBeInTheDocument();
    // Mei has booking-001 + booking-004 (both pending_review) in the seed → 2 active (async load).
    expect(await screen.findByText('2 个进行中预约')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开定价规则' })).toHaveAttribute(
      'href',
      '/merchant/manage'
    );
    expect(screen.getByRole('link', { name: /管理款式集合/i })).toHaveAttribute('href', '/merchant/styles');
    expect(screen.getByRole('link', { name: '隐私政策' })).toHaveAttribute(
      'href',
      '/privacy'
    );
  });

  it('switches the merchant profile surface language to English', async () => {
    const user = userEvent.setup();

    renderMerchantProfilePage();

    expect(screen.getByRole('heading', { name: '门店资料' })).toBeInTheDocument();
    expect(screen.getByText('本周预约')).toBeInTheDocument();
    const entry = screen.getByRole('button', { name: '语言设置' });
    const privacy = screen.getByRole('link', { name: '隐私政策' });

    expect(entry).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
    expect(entry.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(entry);

    expect(screen.getByRole('radiogroup', { name: '语言设置' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '中文' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('radio', { name: 'English' }));

    expect(screen.getByRole('heading', { name: 'Studio profile' })).toBeInTheDocument();
    expect(screen.getByText('Appointments this week')).toBeInTheDocument();
    expect(await screen.findByText('2 active bookings')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage collection/i })).toHaveAttribute('href', '/merchant/styles');
    const englishEntry = screen.getByRole('button', { name: 'Language' });
    expect(englishEntry).toHaveAttribute('aria-expanded', 'false');
    expect(englishEntry).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Chinese' })).not.toBeInTheDocument();
  });
});
