import type { AppLanguage } from '@/i18n/types';

export const uiMessageKeys = [
  'profile.language.switch',
  'profile.language.zh',
  'profile.language.en',
  'layout.openProfile',
  'layout.newNailDesign',
  'booking.steps.upload',
  'booking.steps.result',
  'booking.steps.quote',
  'booking.progress',
  'booking.step1',
  'booking.step2',
  'booking.step3',
  'booking.upload.title',
  'booking.upload.prefill',
  'booking.upload.analyze',
  'booking.upload.changePhoto',
  'booking.upload.example',
  'booking.upload.choosePhoto',
  'booking.upload.uploadPhoto',
  'booking.result.title',
  'booking.result.loadingTitle',
  'booking.result.loadingBody',
  'booking.result.errorTitle',
  'booking.result.quoteCta',
  'booking.quote.title',
  'booking.quote.back',
  'booking.quote.next',
  'booking.quote.studioPrice',
  'booking.quote.aiEstimate',
  'booking.confirm.eyebrow',
  'booking.confirm.emptyHeading',
  'booking.confirm.emptyTitle',
  'booking.confirm.emptyBody',
  'booking.confirm.start',
  'booking.confirm.heading',
  'booking.confirm.helper',
  'booking.confirm.referenceAlt',
  'booking.confirm.estimated',
  'booking.confirm.notes',
  'booking.confirm.notesPlaceholder',
  'booking.confirm.confirm',
  'booking.confirm.confirming',
  'booking.confirm.confirmed',
  'booking.confirm.openMessages',
] as const;

export type UiMessageKey = (typeof uiMessageKeys)[number];

export type UiMessages = Record<UiMessageKey, string>;

const zhCNMessages = {
  'profile.language.switch': '切换语言',
  'profile.language.zh': '中文',
  'profile.language.en': '英文',
  'layout.openProfile': '打开个人资料',
  'layout.newNailDesign': '新的美甲设计',
  'booking.steps.upload': '上传',
  'booking.steps.result': '识别结果',
  'booking.steps.quote': '报价',
  'booking.progress': '预约进度',
  'booking.step1': '第 1 步',
  'booking.step2': '第 2 步',
  'booking.step3': '第 3 步',
  'booking.upload.title': '上传你的美甲参考图',
  'booking.upload.prefill': '分析款式',
  'booking.upload.analyze': '分析我的照片',
  'booking.upload.changePhoto': '更换照片',
  'booking.upload.example': '试试示例图',
  'booking.upload.choosePhoto': '选择美甲参考图',
  'booking.upload.uploadPhoto': '上传或拍摄照片',
  'booking.result.title': '款式识别结果',
  'booking.result.loadingTitle': '正在读取款式',
  'booking.result.loadingBody': '正在识别甲型、颜色和效果…',
  'booking.result.errorTitle': '识别需要你留意',
  'booking.result.quoteCta': '查看我的报价',
  'booking.quote.title': '你的报价',
  'booking.quote.back': '返回',
  'booking.quote.next': '下一步：选择时间',
  'booking.quote.studioPrice': '门店报价',
  'booking.quote.aiEstimate': 'AI 估价',
  'booking.confirm.eyebrow': '确认预约',
  'booking.confirm.emptyHeading': '先选择一个款式',
  'booking.confirm.emptyTitle': '还没有选择款式',
  'booking.confirm.emptyBody': '先从首页挑一个款式，或上传你自己的参考图查看报价，然后再回来确定时间。',
  'booking.confirm.start': '开始预约',
  'booking.confirm.heading': '选择你的预约时间',
  'booking.confirm.helper': '请在下方选择你偏好的时间段。',
  'booking.confirm.referenceAlt': '预约参考图',
  'booking.confirm.estimated': '预估',
  'booking.confirm.notes': '备注',
  'booking.confirm.notesPlaceholder': '如有特殊要求请在此注明，例如：对某些材料过敏、希望避免某些颜色、甲型偏好等。',
  'booking.confirm.confirm': '确认预约',
  'booking.confirm.confirming': '确认中…',
  'booking.confirm.confirmed': '预约已确认',
  'booking.confirm.openMessages': '打开预约消息',
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
