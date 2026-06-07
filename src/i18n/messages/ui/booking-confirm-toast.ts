import type { AppLanguage } from '@/i18n/types';

const copy = {
  'zh-CN': {
    confirmed: (name: string, time: string) => `已为你预约 ${name}，时间是 ${time}。`,
    pending: (name: string, time: string) => `${name} 的预约待确认，时间是 ${time}。`,
    overlap: '该技师刚刚被其他预约占用，请重新选择时间。',
    failed: '暂时无法确认预约，请稍后再试。',
  },
  en: {
    confirmed: (name: string, time: string) => `Confirmed with ${name} at ${time}.`,
    pending: (name: string, time: string) => `Pending review with ${name} at ${time}.`,
    overlap: 'That technician was just booked for an overlapping time. Please pick another slot.',
    failed: 'Could not confirm the appointment. Please try again.',
  },
} as const;

export function bookingConfirmSuccessToast(
  language: AppLanguage,
  input: { status: 'confirmed' | 'pending_review'; technicianName: string; time: string },
): string {
  const messages = copy[language];
  return input.status === 'confirmed'
    ? messages.confirmed(input.technicianName, input.time)
    : messages.pending(input.technicianName, input.time);
}

export function bookingConfirmOverlapToast(language: AppLanguage): string {
  return copy[language].overlap;
}

export function bookingConfirmFailedToast(language: AppLanguage): string {
  return copy[language].failed;
}
