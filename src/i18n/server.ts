import 'server-only';

import type { UserRole } from '@/domain/nail';
import type { AppLanguage } from '@/i18n/types';
import { getDefaultLanguage, isAppLanguage } from '@/i18n/storage';

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
