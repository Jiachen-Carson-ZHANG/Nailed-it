'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';

import type { UserRole } from '@/domain/nail';
import type { AppLanguage } from '@/i18n/types';
import enMessages from '@/i18n/messages/ui/en';
import {
  getUiMessage,
  getUiMessageDictionary,
  type UiMessageKey,
} from '@/i18n/messages/ui/zh-CN';
import { getDefaultLanguage, loadLanguage, saveLanguage } from '@/i18n/storage';

type LanguageContextValue = {
  language: AppLanguage;
  role: UserRole;
  setLanguage: (language: AppLanguage) => void;
  t: (key: UiMessageKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const uiMessages = getUiMessageDictionary(enMessages);

type LanguageProviderProps = {
  children: React.ReactNode;
  initialLanguage?: AppLanguage;
  role: UserRole;
};

export function LanguageProvider({
  children,
  initialLanguage,
  role,
}: LanguageProviderProps) {
  const [language, setLanguageState] = useState<AppLanguage>(initialLanguage ?? getDefaultLanguage());
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;

      if (initialLanguage !== undefined) {
        return;
      }
    }

    // 当角色切换时，重新读取该角色各自的语言偏好，避免串值。
    setLanguageState(loadLanguage(role));
  }, [initialLanguage, role]);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    saveLanguage(role, nextLanguage);
  };

  const t = (key: UiMessageKey) => getUiMessage(uiMessages, language, key);

  return (
    <LanguageContext.Provider
      value={{
        language,
        role,
        setLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);

  if (context) {
    return context;
  }

  throw new Error('useLanguage must be used within a LanguageProvider');
}
