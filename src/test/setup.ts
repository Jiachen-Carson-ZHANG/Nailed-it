import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Global next/navigation mock. MobileLayout (rendered by most page tests) uses ResetLink ->
// useRouter, so every test that mounts it needs the navigation hooks stubbed. Files that need a
// specific pathname still override usePathname locally; this provides the safe defaults.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// 保证每个测试用例之间没有残留 DOM，避免脚手架阶段的测试互相污染。
afterEach(() => {
  cleanup();
});
