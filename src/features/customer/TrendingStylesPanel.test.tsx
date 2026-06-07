import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrendingStylesPanel, resetTrendingCacheForTests } from './TrendingStylesPanel';

const fetchMock = vi.fn();

describe('TrendingStylesPanel', () => {
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

    render(<TrendingStylesPanel />);

    expect(screen.getByRole('heading', { name: '热门款式' })).toBeInTheDocument();
    expect(screen.getByText('AI自动识别抓取近期热门款式')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/ai/trending-styles');
    });

    expect(await screen.findByText('镜面银猫眼')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.queryByText('Mirror Chrome')).not.toBeInTheDocument();
    expect(screen.queryByText('Trending Now')).not.toBeInTheDocument();
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

    render(<TrendingStylesPanel />);

    await screen.findByText('粉雾光疗');

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
