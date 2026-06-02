import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LandingPage from './page';

function renderLandingPage() {
  render(<LandingPage />);
}

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
  it('renders exactly five top-level labeled regions in the approved order', () => {
    renderLandingPage();

    expect(getTopLevelRegions()).toHaveLength(5);
    expect(getTopLevelRegions().map((region) => region.getAttribute('aria-label'))).toEqual([
      'Hero',
      'Problem',
      'Solution',
      'Why It Works',
      'CTA'
    ]);
  });

  it('renders the approved hero and CTA route targets', () => {
    renderLandingPage();

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
    expect(screen.getByText('试戴选款， 帮助决策')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '准备好让美甲预约更智能了吗？' })).toBeInTheDocument();
  });

  it('switches the solution panel when a different tab is pressed', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    const solution = screen.getByRole('region', { name: 'Solution' });

    await user.click(screen.getByRole('tab', { name: '款式购物车' }));

    expect(within(solution).getByRole('heading', { name: '款式购物车' })).toBeInTheDocument();
    expect(within(solution).getByText('试戴比较， 快速决策')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '商家图册' }));

    expect(within(solution).getByRole('heading', { name: '商家图册' })).toBeInTheDocument();
    expect(within(solution).getByText('自动归档， 持续种草')).toBeInTheDocument();
  });
});
