import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { TrendingStylesPanel, resetTrendingCacheForTests } from './TrendingStylesPanel';

const fetchMock = vi.fn();

describe('TrendingStylesPanel', () => {
  function renderPanel(language: 'zh-CN' | 'en' = 'zh-CN') {
    return render(
      <LanguageProvider initialLanguage={language} role="customer">
        <TrendingStylesPanel />
      </LanguageProvider>
    );
  }

  beforeEach(() => {
    resetTrendingCacheForTests();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads trending styles on first render and keeps only the Chinese title copy', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-06-06T00:00:00.000Z',
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
    });

    renderPanel();

    expect(screen.getByRole('heading', { name: '热门' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '加载中…' })).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/ai/trending-styles');
    });

    expect(await screen.findByText('镜面银猫眼')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument();
    expect(screen.queryByText('Mirror Chrome')).not.toBeInTheDocument();
  });

  it('refreshes the list when the user clicks refresh', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: '2026-06-06T00:00:00.000Z',
        styles: [
          {
            rank: 1,
            name: 'Pink Aura',
            nameCn: '粉雾光疗',
            description: 'desc',
            tags: [],
            searchLinks: []
          }
        ]
      })
    });

    renderPanel('en');

    await screen.findByText('Pink Aura');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
