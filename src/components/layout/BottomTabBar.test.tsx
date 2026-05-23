import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BottomTabBar } from './BottomTabBar';

let mockedPathname = '/customer/home';

vi.mock('next/navigation', () => ({
  usePathname: () => mockedPathname
}));

describe('BottomTabBar', () => {
  it('renders only currently available tabs for the active role', () => {
    mockedPathname = '/customer/home';
    render(<BottomTabBar role="customer" />);

    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/customer/home');
    expect(screen.getByRole('link', { name: /book/i })).toHaveAttribute('href', '/customer/booking');
    expect(screen.queryByRole('link', { name: /messages/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^me$/i })).not.toBeInTheDocument();
  });

  it('keeps the booking tab active on nested booking routes', () => {
    mockedPathname = '/customer/booking/confirm';
    render(<BottomTabBar role="customer" />);

    expect(screen.getByRole('link', { name: /book/i })).toHaveClass('tab-item-active');
  });
});
