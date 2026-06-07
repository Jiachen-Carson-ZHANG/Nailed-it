import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { BottomTabBar } from './BottomTabBar';

let mockedPathname = '/customer/home';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => mockedPathname
}));

describe('BottomTabBar', () => {
  it('renders the full customer tab set once the routes are available', () => {
    mockedPathname = '/customer/home';
    render(
      <LanguageProvider initialLanguage="zh-CN" role="customer">
        <BottomTabBar role="customer" />
      </LanguageProvider>
    );

    expect(screen.getByRole('link', { name: '首页' })).toHaveAttribute('href', '/customer/home');
    expect(screen.getByRole('link', { name: '预约' })).toHaveAttribute('href', '/customer/booking');
    expect(screen.getByRole('link', { name: '消息' })).toHaveAttribute(
      'href',
      '/customer/messages'
    );
    expect(screen.getByRole('link', { name: '我的' })).toHaveAttribute('href', '/customer/profile');
  });

  it('keeps the booking tab active on nested booking routes', () => {
    mockedPathname = '/customer/booking/confirm';
    render(
      <LanguageProvider initialLanguage="zh-CN" role="customer">
        <BottomTabBar role="customer" />
      </LanguageProvider>
    );

    expect(screen.getByRole('link', { name: '预约' })).toHaveClass('tab-item-active');
  });

  it('keeps the messages tab active on nested message routes', () => {
    mockedPathname = '/customer/messages/conv-merchant';
    render(
      <LanguageProvider initialLanguage="zh-CN" role="customer">
        <BottomTabBar role="customer" />
      </LanguageProvider>
    );

    expect(screen.getByRole('link', { name: '消息' })).toHaveClass('tab-item-active');
  });

  it('renders English tab labels when the language is English', () => {
    mockedPathname = '/customer/home';
    render(
      <LanguageProvider initialLanguage="en" role="customer">
        <BottomTabBar role="customer" />
      </LanguageProvider>
    );

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/customer/home');
    expect(screen.getByRole('link', { name: 'Book' })).toHaveAttribute('href', '/customer/booking');
    expect(screen.getByRole('link', { name: 'Messages' })).toHaveAttribute(
      'href',
      '/customer/messages'
    );
    expect(screen.getByRole('link', { name: 'Me' })).toHaveAttribute('href', '/customer/profile');
  });
});
