export type AppLanguage = 'zh-CN' | 'en';

export type LocalizedText = Record<AppLanguage, string>;

export type PricingUnitLabel = 'per_finger';

export type BookingStatusLabel =
  | 'pending_review'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
