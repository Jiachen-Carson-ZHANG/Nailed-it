import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDefaultLanguage, loadLanguage, saveLanguage } from '@/i18n/storage';

describe('language storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists customer and merchant languages independently', () => {
    saveLanguage('customer', 'en');
    saveLanguage('merchant', 'zh-CN');

    expect(window.localStorage.getItem('customer-language')).toBe('en');
    expect(window.localStorage.getItem('merchant-language')).toBe('zh-CN');
  });

  it('loads role-specific language values', () => {
    window.localStorage.setItem('customer-language', 'en');
    window.localStorage.setItem('merchant-language', 'zh-CN');

    expect(loadLanguage('customer')).toBe('en');
    expect(loadLanguage('merchant')).toBe('zh-CN');
  });

  it('falls back to the default language for invalid stored values', () => {
    window.localStorage.setItem('customer-language', 'fr');

    expect(loadLanguage('customer')).toBe(getDefaultLanguage());
  });

  it('falls back gracefully when localStorage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(loadLanguage('customer')).toBe(getDefaultLanguage());
  });

  it('does not throw when localStorage cannot be written', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => saveLanguage('merchant', 'en')).not.toThrow();
    expect(setItemSpy).toHaveBeenCalledWith('merchant-language', 'en');
  });
});
