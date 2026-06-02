import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from './page';
import styles from './page.module.css';

vi.mock('@/domain/session', () => ({
  getMockSession: (role: 'customer' | 'merchant') => ({
    role,
    homePath: role === 'customer' ? '/mock-customer-home' : '/mock-merchant-calendar'
  })
}));

describe('LandingPage', () => {
  it('renders the approved landing story and both entry routes', () => {
    const { container } = render(<LandingPage />);

    expect(
      screen.getByRole('heading', {
        name: '让美甲预约更智能'
      })
    ).toBeInTheDocument();
    expect(screen.getByText('少沟通、多成交')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: '好看的款式背后，是低效的预约流程'
      })
    ).toBeInTheDocument();
    expect(screen.getByText('AI 识图')).toBeInTheDocument();
    expect(screen.getByText('款式购物车')).toBeInTheDocument();
    expect(screen.getByText('商家图册')).toBeInTheDocument();

    expect(
      screen.getByRole('link', {
        name: /用户入口/i
      })
    ).toHaveAttribute('href', '/mock-customer-home');
    expect(
      screen.getByRole('link', {
        name: /商家入口/i
      })
    ).toHaveAttribute('href', '/mock-merchant-calendar');

    // 回归保护：hero 三张图需要显式 class，避免依赖 DOM 顺序绑定样式职责
    expect(container.querySelector(`.${styles.heroShadow}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.heroLogo}`)).toBeInTheDocument();
    expect(container.querySelector(`.${styles.heroIcon}`)).toBeInTheDocument();
  });
});
