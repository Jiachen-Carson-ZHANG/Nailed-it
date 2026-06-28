import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrendingStylesPanel } from './TrendingStylesPanel';

// The panel renders a static, curated trending list (no fetch/cache) and shows only the Chinese
// title copy. (Was previously fetch-backed; rewritten when it became static.)
describe('TrendingStylesPanel', () => {
  it('renders the header and the static Chinese trending titles', () => {
    render(<TrendingStylesPanel />);

    expect(screen.getByRole('heading', { name: '热门款式' })).toBeInTheDocument();
    expect(screen.getByText('AI自动识别抓取近期热门款式')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();

    expect(screen.getByText('日晒感生物凝胶渐变甲')).toBeInTheDocument();
    expect(screen.getByText('幻彩海玻璃碎封装甲')).toBeInTheDocument();
    expect(screen.getByText('温变迷你棋盘手印甲')).toBeInTheDocument();
  });

  it('shows only the Chinese name, not the English copy', () => {
    render(<TrendingStylesPanel />);
    expect(screen.queryByText('Sun-kissed Bio Gel Gradient Nails')).not.toBeInTheDocument();
  });
});
