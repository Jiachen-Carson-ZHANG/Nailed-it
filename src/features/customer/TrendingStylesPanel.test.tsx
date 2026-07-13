import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrendingStylesPanel } from './TrendingStylesPanel';

// The panel renders a static, curated trending list (no fetch/cache) and shows only the Chinese
// title copy. (Was previously fetch-backed; rewritten when it became static.)
describe('TrendingStylesPanel', () => {
  it('renders the heading and subtitle', () => {
    render(<TrendingStylesPanel />);
    expect(screen.getByRole('heading', { name: '热门款式' })).toBeInTheDocument();
    expect(screen.getByText('AI自动识别抓取近期热门款式')).toBeInTheDocument();
  });

  it('starts collapsed — trending list is not visible', () => {
    render(<TrendingStylesPanel />);
    const body = document.getElementById('trending-panel-body');
    expect(body).not.toBeNull();
    expect(body?.style.display).toBe('none');
  });

  it('expands when the toggle button is clicked', () => {
    render(<TrendingStylesPanel />);
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const body = document.getElementById('trending-panel-body');
    expect(body?.style.display).not.toBe('none');
  });

  it('collapses again on a second click', () => {
    render(<TrendingStylesPanel />);
    const toggle = screen.getByRole('button');

    fireEvent.click(toggle);
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const body = document.getElementById('trending-panel-body');
    expect(body?.style.display).toBe('none');
  });

  it('shows the static trending styles when expanded', () => {
    render(<TrendingStylesPanel />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('日晒感生物凝胶渐变甲')).toBeInTheDocument();
    expect(screen.getByText('幻彩海玻璃碎封装甲')).toBeInTheDocument();
    expect(screen.getByText('温变迷你棋盘手印甲')).toBeInTheDocument();
  });
});
