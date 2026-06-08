import { beforeEach, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { merchantEntryHintPendingKey } from '@/lib/merchant-entry-hint';
import LandingPage from './page';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  )
}));

vi.mock('next/font/local', () => ({
  default: () => ({
    className: 'font-landing-serif',
    style: { fontFamily: '"Source Han Serif SC", serif' },
    variable: 'font-landing-serif-variable'
  })
}));

function renderLandingPage() {
  render(<LandingPage />);
}

beforeEach(() => {
  window.localStorage.clear();
});

function getTopLevelRegions() {
  const main = screen.getByRole('main');

  // 只统计 main 的直接子 section，避免把后续组件内部的嵌套 region 误算进来。
  return Array.from(main.children).filter((element): element is HTMLElement => {
    if (!(element instanceof HTMLElement) || element.tagName !== 'SECTION') {
      return false;
    }

    // 顶层 section 必须本身就是可访问的 region，而不是依赖后代节点提供语义。
    return element.matches('section[aria-label], section[aria-labelledby]');
  });
}

describe('LandingPage', () => {
  it('renders exactly six top-level labeled regions in the approved order', () => {
    renderLandingPage();

    const topLevelRegions = getTopLevelRegions();
    const expectedRegionNames = [
      'Hero',
      'Problem',
      'Solution',
      'Journey',
      'Why It Works',
      'CTA'
    ];

    expect(topLevelRegions).toHaveLength(6);
    expectedRegionNames.forEach((expectedName, index) => {
      expect(topLevelRegions[index]).toHaveAccessibleName(expectedName);
    });
  });

  it('renders the approved hero and CTA route targets', () => {
    renderLandingPage();

    const heroLinks = screen.getAllByRole('link', {
      name: /^(用户入口|商家入口)$/
    });
    const ctaLinks = screen.getAllByRole('link', {
      name: /^(Try as User|Try as Merchant)$/
    });

    expect(heroLinks.map((link) => link.textContent)).toEqual(['商家入口', '用户入口']);
    expect(ctaLinks.map((link) => link.textContent)).toEqual([
      'Try as Merchant',
      'Try as User'
    ]);

    expect(screen.getByRole('link', { name: '用户入口' })).toHaveAttribute('href', '/customer/home');
    expect(screen.getByRole('link', { name: '商家入口' })).toHaveAttribute(
      'href',
      '/merchant/calendar'
    );
    expect(screen.getByRole('link', { name: 'Try as User' })).toHaveAttribute(
      'href',
      '/customer/home'
    );
    expect(screen.getByRole('link', { name: 'Try as Merchant' })).toHaveAttribute(
      'href',
      '/merchant/calendar'
    );
  });

  it('renders the required landing redesign copy', () => {
    renderLandingPage();

    expect(screen.getByRole('heading', { name: '少沟通，多成交' })).toBeInTheDocument();
    expect(screen.getByText('好看的款式背后，是低效的预约流程')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AI 识图' })).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === '试戴选款帮助决策')
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '准备好让美甲预约更智能了吗？' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Nailed-it' })).toBeInTheDocument();
  });

  it('switches the solution panel when a different tab is pressed', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    const solution = screen.getByRole('region', { name: 'Solution' });

    expect(within(solution).getByAltText('AI 识图截图')).toBeInTheDocument();

    await user.click(within(solution).getByRole('tab', { name: '款式购物车' }));

    expect(within(solution).getByRole('heading', { name: '款式购物车' })).toBeInTheDocument();
    expect(within(solution).getByText('试戴比较，快速决策')).toBeInTheDocument();
    expect(within(solution).getByAltText('款式购物车截图')).toBeInTheDocument();

    await user.click(within(solution).getByRole('tab', { name: '商家图册' }));

    expect(within(solution).getByRole('heading', { name: '商家图册' })).toBeInTheDocument();
    expect(within(solution).getByText('自动归档，持续种草')).toBeInTheDocument();
    expect(within(solution).getByAltText('商家图册截图')).toBeInTheDocument();
  });

  it('queues the merchant first-visit hint when a merchant entry is clicked for the first time', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    await user.click(screen.getByRole('link', { name: '商家入口' }));

    expect(window.localStorage.getItem(merchantEntryHintPendingKey)).toBe('true');
  });

  it('renders journey screenshots and keeps the missing user booking step as a placeholder', () => {
    renderLandingPage();

    expect(screen.getAllByAltText('商家旅程第1步截图')).not.toHaveLength(0);
    expect(screen.getAllByAltText('商家旅程第4步截图')).not.toHaveLength(0);
    expect(screen.getAllByAltText('用户旅程第1步截图')).not.toHaveLength(0);
    expect(screen.getAllByAltText('用户旅程第3步截图')).not.toHaveLength(0);
    expect(screen.queryByAltText('用户旅程第4步截图')).not.toBeInTheDocument();
  });
});
