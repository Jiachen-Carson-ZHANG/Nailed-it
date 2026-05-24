import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 保证每个测试用例之间没有残留 DOM，避免脚手架阶段的测试互相污染。
afterEach(() => {
  cleanup();
});
