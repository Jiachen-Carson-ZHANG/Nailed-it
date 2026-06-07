import { describe, expect, it } from 'vitest';
import enMessages from '@/i18n/messages/ui/en';
import zhCNMessages, { uiMessageKeys } from '@/i18n/messages/ui/zh-CN';

describe('ui messages dictionary', () => {
  it('keeps zh-CN and en keys in sync', () => {
    for (const key of uiMessageKeys) {
      expect(zhCNMessages[key], `missing zh-CN value for ${key}`).toBeTruthy();
      expect(enMessages[key], `missing en value for ${key}`).toBeTruthy();
    }

    expect(Object.keys(enMessages).sort()).toEqual([...uiMessageKeys].sort());
    expect(Object.keys(zhCNMessages).sort()).toEqual([...uiMessageKeys].sort());
  });
});
