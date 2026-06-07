import type { AppLanguage } from '@/i18n/types';

const technicianFallback: Record<AppLanguage, string> = {
  'zh-CN': '你的技师',
  en: 'your technician',
};

/** System message when a booking is created and awaits merchant review. */
export function bookingPendingReviewMessage(
  language: AppLanguage,
  technicianName: string,
  time: string,
): string {
  const name = technicianName || technicianFallback[language];
  if (language === 'zh-CN') {
    return `你的预约正在等待商家确认，技师 ${name}，时间 ${time}。`;
  }
  return `Your appointment is pending merchant review with ${name} at ${time}.`;
}

/** Merchant message when an appointment is marked complete. */
export function bookingCompletedThankYouMessage(language: AppLanguage): string {
  if (language === 'zh-CN') {
    return '你的预约已完成，感谢光临！希望你喜欢这次的美甲，期待下次再见。';
  }
  return 'Your appointment is complete — thank you for visiting! We hope you love your nails. See you next time!';
}
