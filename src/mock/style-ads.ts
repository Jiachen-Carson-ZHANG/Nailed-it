import type { StyleAdCenterSnapshot, StyleAdSummary, StyleAdView } from '@/domain/style-ad';
import {
  DEFAULT_CUSTOM_AUDIENCE,
  DEFAULT_DURATION_DAYS,
  DEFAULT_TARGET_EXPOSURE,
  DEFAULT_TARGET_ROI,
} from '@/domain/style-ad';
import { demoMerchantId } from './merchants';
import { styleDefinitions } from './styles';

const SEEDED_AT = '2026-05-01T00:00:00.000Z';

function styleMeta(styleId: string) {
  const style = styleDefinitions.find((entry) => entry.id === styleId);
  if (!style) {
    throw new Error(`mock style ads require style ${styleId}`);
  }
  return {
    styleTitle: style.title,
    styleImageUrl: style.imageUrl,
  };
}

export const mockStyleAdCampaigns: StyleAdSummary[] = [
  {
    id: 'ad-rose-cat-eye',
    styleId: 'rose-cat-eye',
    ...styleMeta('rose-cat-eye'),
    status: 'active',
    dailyBudgetCents: 3000,
    impressions: 1240,
    clicks: 86,
    bookings: 4,
    spendCents: 18200,
    updatedAt: SEEDED_AT,
    sourceRunId: null,
    hypothesis: null,
  },
  {
    id: 'ad-soft-french',
    styleId: 'soft-french',
    ...styleMeta('soft-french'),
    status: 'active',
    dailyBudgetCents: 2500,
    impressions: 980,
    clicks: 62,
    bookings: 2,
    spendCents: 14600,
    updatedAt: SEEDED_AT,
    sourceRunId: null,
    hypothesis: null,
  },
];

export const mockStyleAdCenterSnapshot: StyleAdCenterSnapshot = {
  activeCampaigns: mockStyleAdCampaigns.length,
  totalImpressions: mockStyleAdCampaigns.reduce((sum, row) => sum + row.impressions, 0),
  totalClicks: mockStyleAdCampaigns.reduce((sum, row) => sum + row.clicks, 0),
  totalBookings: mockStyleAdCampaigns.reduce((sum, row) => sum + row.bookings, 0),
  totalSpendCents: mockStyleAdCampaigns.reduce((sum, row) => sum + row.spendCents, 0),
  campaigns: mockStyleAdCampaigns,
};

export const mockActiveStyleAdIds = new Set(mockStyleAdCampaigns.map((row) => row.styleId));

export function getMockStyleAdView(styleId: string): StyleAdView | null {
  const active = mockStyleAdCampaigns.find((row) => row.styleId === styleId);
  if (active) {
    return {
      id: active.id,
      styleId: active.styleId,
      styleTitle: active.styleTitle,
      styleImageUrl: active.styleImageUrl,
      status: active.status,
      promotionGoal: 'homepage_exposure',
      targetExposure: DEFAULT_TARGET_EXPOSURE,
      targetRoi: DEFAULT_TARGET_ROI,
      startAt: null,
      durationDays: 14,
      audienceMode: 'smart',
      customAudience: { ...DEFAULT_CUSTOM_AUDIENCE, preferenceTags: [] },
      dailyBudgetCents: active.dailyBudgetCents,
      notes: '',
      updatedAt: active.updatedAt,
    };
  }

  const style = styleDefinitions.find((entry) => entry.id === styleId);
  if (!style) return null;

  return {
    id: `ad-draft-${styleId}`,
    styleId,
    styleTitle: style.title,
    styleImageUrl: style.imageUrl,
    status: 'draft',
    promotionGoal: 'homepage_exposure',
    targetExposure: DEFAULT_TARGET_EXPOSURE,
    targetRoi: DEFAULT_TARGET_ROI,
    startAt: null,
    durationDays: DEFAULT_DURATION_DAYS,
    audienceMode: 'smart',
    customAudience: { ...DEFAULT_CUSTOM_AUDIENCE, preferenceTags: [] },
    dailyBudgetCents: null,
    notes: '',
    updatedAt: SEEDED_AT,
  };
}

export const mockStyleAdMerchantId = demoMerchantId;
