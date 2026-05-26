import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BottomTabBar } from './BottomTabBar';

let mockedPathname = '/customer/home';

vi.mock('next/navigation', () => ({
  usePathname: () => mockedPathname
}));

describe('BottomTabBar', () => {
  it('renders the full customer tab set once the routes are available', () => {
    mockedPathname = '/customer/home';
    render(<BottomTabBar role="customer" />);

    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/customer/home');
    expect(screen.getByRole('link', { name: /^book$/i })).toHaveAttribute('href', '/customer/booking');
    expect(screen.getByRole('link', { name: /messages/i })).toHaveAttribute(
      'href',
      '/customer/messages'
    );
    expect(screen.getByRole('link', { name: /^me$/i })).toHaveAttribute('href', '/customer/profile');
  });

  it('keeps the booking tab active on nested booking routes', () => {
    mockedPathname = '/customer/booking/confirm';
    render(<BottomTabBar role="customer" />);

    expect(screen.getByRole('link', { name: /^book$/i })).toHaveClass('tab-item-active');
  });

  it('keeps the messages tab active on nested message routes', () => {
    mockedPathname = '/customer/messages/conv-merchant';
    render(<BottomTabBar role="customer" />);

    expect(screen.getByRole('link', { name: /messages/i })).toHaveClass('tab-item-active');
  });
});
