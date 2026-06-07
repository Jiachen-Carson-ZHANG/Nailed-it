import type { AppLanguage } from '@/i18n/types';

export const uiMessageKeys = [
  'profile.language.switch',
  'profile.language.zh',
  'profile.language.en',
  'layout.openProfile',
  'layout.newNailDesign',
] as const;

export type UiMessageKey = (typeof uiMessageKeys)[number];

export type UiMessages = Record<UiMessageKey, string>;

const zhCNMessages = {
  'profile.language.switch': '切换语言',
  'profile.language.zh': '中文',
  'profile.language.en': '英文',
  'layout.openProfile': '打开个人资料',
  'layout.newNailDesign': '新的美甲设计',
} satisfies UiMessages;

type UiMessageDictionary = Record<AppLanguage, UiMessages>;

export function getUiMessageDictionary(enMessages: UiMessages): UiMessageDictionary {
  return {
    'zh-CN': zhCNMessages,
    en: enMessages,
  };
}

export function getUiMessage(
  dictionary: UiMessageDictionary,
  language: AppLanguage,
  key: UiMessageKey
): string {
  return dictionary[language][key];
}

export default zhCNMessages;
