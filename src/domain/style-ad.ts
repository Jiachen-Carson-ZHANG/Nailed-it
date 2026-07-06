export const styleAdStatuses = ['draft', 'active', 'paused', 'ended'] as const;

export type StyleAdStatus = (typeof styleAdStatuses)[number];

export type StyleAdSummary = {
  id: string;
  styleId: string;
  styleTitle: string;
  styleImageUrl: string;
  status: StyleAdStatus;
  dailyBudgetCents: number | null;
  impressions: number;
  clicks: number;
  bookings: number;
  spendCents: number;
  updatedAt: string;
};

export type StyleAdCenterSnapshot = {
  activeCampaigns: number;
  totalImpressions: number;
  totalClicks: number;
  totalBookings: number;
  totalSpendCents: number;
  campaigns: StyleAdSummary[];
};

export type StyleAdView = {
  id: string;
  styleId: string;
  styleTitle: string;
  styleImageUrl: string;
  status: StyleAdStatus;
  dailyBudgetCents: number | null;
  durationDays: number | null;
  notes: string;
  updatedAt: string;
};
