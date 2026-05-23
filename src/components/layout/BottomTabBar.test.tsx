import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BottomTabBar } from './BottomTabBar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/home'
}));

describe('BottomTabBar', () => {
  it('renders only currently available tabs for the active role', () => {
    render(<BottomTabBar role="customer" />);

    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/customer/home');
    expect(screen.queryByRole('link', { name: /book/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /messages/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^me$/i })).not.toBeInTheDocument();
  });
});
