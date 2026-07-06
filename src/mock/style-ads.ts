import type { StyleAdCenterSnapshot, StyleAdSummary, StyleAdView } from '@/domain/style-ad';
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
      dailyBudgetCents: active.dailyBudgetCents,
      durationDays: 14,
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
    dailyBudgetCents: null,
    durationDays: null,
    notes: '',
    updatedAt: SEEDED_AT,
  };
}

export const mockStyleAdMerchantId = demoMerchantId;
