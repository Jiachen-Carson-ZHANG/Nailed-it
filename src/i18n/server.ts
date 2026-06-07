import 'server-only';

import type { UserRole } from '@/domain/nail';
import type { AppLanguage } from '@/i18n/types';
import enMessages from '@/i18n/messages/ui/en';
import {
  getUiMessage,
  getUiMessageDictionary,
  type UiMessageKey,
} from '@/i18n/messages/ui/zh-CN';
import { getDefaultLanguage, isAppLanguage } from '@/i18n/storage';

const uiMessages = getUiMessageDictionary(enMessages);

export function resolveServerLanguage(
  role: UserRole,
  language?: string | null
): {
  language: AppLanguage;
  role: UserRole;
} {
  return {
    language: isAppLanguage(language) ? language : getDefaultLanguage(),
    role,
  };
}

export function getServerUiMessage(language: AppLanguage, key: UiMessageKey): string {
  return getUiMessage(uiMessages, language, key);
}
