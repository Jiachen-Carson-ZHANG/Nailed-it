import type { UserRole } from '@/domain/nail';
import type { AppLanguage } from '@/i18n/types';

const DEFAULT_LANGUAGE: AppLanguage = 'zh-CN';

const languageStorageKeys: Record<UserRole, string> = {
  customer: 'customer-language',
  merchant: 'merchant-language',
};

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return value === 'zh-CN' || value === 'en';
}

export function getDefaultLanguage(): AppLanguage {
  return DEFAULT_LANGUAGE;
}

export function getLanguageStorageKey(role: UserRole): string {
  return languageStorageKeys[role];
}

export function loadLanguage(role: UserRole): AppLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  try {
    const storedLanguage = window.localStorage.getItem(getLanguageStorageKey(role));

    return isAppLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function saveLanguage(role: UserRole, language: AppLanguage): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(getLanguageStorageKey(role), language);
  } catch {
    // 忽略持久化失败，避免语言切换因为浏览器存储异常而中断。
  }
}
