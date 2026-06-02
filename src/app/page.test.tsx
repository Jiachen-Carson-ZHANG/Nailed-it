import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LandingPage from './page';

vi.mock('@/domain/session', () => ({
  getMockSession: (role: 'customer' | 'merchant') => ({
    role,
    homePath: role === 'customer' ? '/mock-customer-home' : '/mock-merchant-calendar'
  })
}));

describe('LandingPage', () => {
  it('renders the approved landing story and both entry routes', () => {
    render(<LandingPage />);

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
  });
});
