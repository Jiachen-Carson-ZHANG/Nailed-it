import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import CustomerHomePage from './page';
import { mockMerchantStyles } from '@/mock/merchant-styles';
import { SavedStylesProvider } from '@/features/customer/SavedStylesContext';
import { LanguageProvider } from '@/i18n/context';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/customer/home'
}));

describe('CustomerHomePage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: '2026-06-07T00:00:00.000Z',
          styles: [
            {
              rank: 1,
              name: 'Mirror Chrome',
              nameCn: '镜面银猫眼',
              description: 'desc',
              tags: [],
              searchLinks: []
            }
          ]
        })
      })
    );
  });

  function renderPage(language: 'zh-CN' | 'en' = 'zh-CN') {
    return render(
      <LanguageProvider initialLanguage={language} role="customer">
        <SavedStylesProvider>
          <CustomerHomePage />
        </SavedStylesProvider>
      </LanguageProvider>
    );
  }

  it('renders the customer home in Chinese mode with the requested labels', async () => {
    renderPage();

    expect(screen.getByRole('link', { name: '+上传款式' })).toHaveAttribute(
      'href',
      '/customer/booking'
    );
    expect(await screen.findByRole('heading', { name: '热门' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '收藏夹' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument();

    for (const style of mockMerchantStyles) {
      expect(
        await screen.findByRole('link', {
          name: new RegExp(style.title, 'i')
        })
      ).toHaveAttribute('href', `/customer/style/${style.id}`);
    }
  });

  it('renders the customer home in English mode with the matching labels', async () => {
    renderPage('en');

    expect(screen.getByRole('link', { name: 'New nail design' })).toHaveAttribute('href', '/customer/booking');
    expect(await screen.findByRole('heading', { name: 'Trending' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Saved' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('renders without non-finite values while styles load', async () => {
    renderPage();

    expect(screen.queryByText(/Infinity|-Infinity/)).not.toBeInTheDocument();
    await screen.findByRole('link', { name: /Rose cat-eye/i });
  });
});
