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
    expect(screen.getByRole('heading', { name: '款式图册' })).toBeInTheDocument();
    expect(screen.queryByText('你的款式集合')).not.toBeInTheDocument();
    expect(screen.getByText('美甲师状态')).toBeInTheDocument();
    expect(screen.getByText('Mei Chen')).toBeInTheDocument();
    // Mei has booking-001 + booking-004 (both pending_review) in the seed → 2 active (async load).
    expect(await screen.findByText('2 个进行中预约')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '打开定价规则' })).toHaveAttribute(
      'href',
      '/merchant/manage'
    );
    expect(screen.getByRole('link', { name: /管理款式图册/i })).toHaveAttribute('href', '/merchant/styles');
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

    await user.click(screen.getByRole('button', { name: '切换语言' }));

    expect(screen.getByRole('heading', { name: 'Studio profile' })).toBeInTheDocument();
    expect(screen.getByText('Appointments this week')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Style lookbook' })).toBeInTheDocument();
    expect(await screen.findByText('2 active bookings')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage lookbook/i })).toHaveAttribute('href', '/merchant/styles');
    expect(screen.getByRole('button', { name: 'Switch language' })).toBeInTheDocument();
  });
});
