import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { resetRepositoriesForTests } from '@/lib/repositories';
import {
  merchantEntryHintPendingKey,
  merchantEntryHintSeenKey
} from '@/lib/merchant-entry-hint';
import MerchantHomePage from './page';

// /merchant/calendar is now the 今日 agent-ops home (renders <TodayHome/> + the first-run entry hint).
// The full calendar behavior lives in ./schedule/page.test.tsx. The home's compute is unit-tested in
// src/domain/merchant-home.test.ts; here we cover the page shell + the onboarding hint.

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/calendar',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn()
  })
}));

vi.mock('@/components/ui/Toast', () => ({
  Toast: ({ message }: { message: string }) => (message ? <div role="status">{message}</div> : null)
}));

describe('MerchantHomePage (今日 home)', () => {
  async function renderPage(language: 'zh-CN' | 'en' = 'en') {
    render(
      <LanguageProvider initialLanguage={language} role="merchant">
        <MerchantHomePage />
      </LanguageProvider>
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T12:00:00Z'));
    window.localStorage.clear();
    resetRepositoriesForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the 今日 home (agent-first), not the calendar heading', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: /^summary$/i })).toBeInTheDocument();
    // The full calendar heading must not be on the home anymore — it moved to /schedule.
    expect(screen.queryByRole('heading', { name: /appointment calendar/i })).not.toBeInTheDocument();
  });

  it('shows the onboarding hint once after arriving from the landing merchant entry', async () => {
    window.localStorage.setItem(merchantEntryHintPendingKey, 'true');

    await renderPage('zh-CN');

    expect(screen.getByText('欢迎入驻！新手商家请先前往下方管理页面设置并保存价目表哦～')).toBeInTheDocument();
    expect(window.localStorage.getItem(merchantEntryHintPendingKey)).toBeNull();
    expect(window.localStorage.getItem(merchantEntryHintSeenKey)).toBe('true');
  });

  it('does not show the onboarding hint again after the first visit is recorded', async () => {
    window.localStorage.setItem(merchantEntryHintPendingKey, 'true');
    window.localStorage.setItem(merchantEntryHintSeenKey, 'true');

    await renderPage('zh-CN');

    expect(
      screen.queryByText('欢迎入驻！新手商家请先前往下方管理页面设置并保存价目表哦～')
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem(merchantEntryHintPendingKey)).toBeNull();
  });
});
