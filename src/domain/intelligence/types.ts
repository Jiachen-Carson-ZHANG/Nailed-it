// Result contracts for the intelligence read model (ADR-0006). Every value here is derived on read
// from analytics_events through the catalog adapter — none of it is stored.

import type { StyleDiscoveryFacet } from '@/domain/nail';

export type TagScore = { label: string; category: string; score: number };

export type CustomerProfile = {
  customerId: string;
  eventCount: number;
  /** All interacted tags, highest weighted-decayed score first. */
  tagScores: TagScore[];
  /** Convenience: tag labels in score order. */
  topTags: string[];
  /** Ranked labels per catalog category ('color' | 'style' | 'nail_shape' | …). */
  topByCategory: Record<string, string[]>;
  /** Mean confirmed-booking price, or null when the customer has not booked. */
  averageBudget: number | null;
  /** Tags touched within the recent window, in overall-score order. */
  recentInterest: string[];
};

export type TrendDirection = 'up' | 'down' | 'flat';

export type DemandTrend = {
  label: string;
  category: string;
  current: number;
  previous: number;
  delta: number;
  direction: TrendDirection;
};

export type StylePerformance = {
  styleId: string;
  title: string;
  impressions: number;
  clicks: number;
  saves: number;
  tryOns: number;
  bookings: number;
  /** bookings / tryOns when tryOns > 0, else null. */
  conversionRate: number | null;
};

export type CatalogGap = {
  label: string;
  category: string;
  searchCount: number;
  matchingActiveStyles: number;
};

export type InsightsSnapshot = {
  rangeDays: number;
  impressions: number;
  clicks: number;
  detailViews: number;
  saves: number;
  tryOns: number;
  bookings: number;
  searches: number;
  activeCustomers: number;
};

export type MerchantInsights = {
  snapshot: InsightsSnapshot;
  demandTrends: DemandTrend[];
  designPerformance: {
    styles: StylePerformance[];
    highInterestLowConversion: StylePerformance[];
  };
  catalogGaps: CatalogGap[];
};

/** One day's funnel pulse, for sparklines in the daily/weekly report cards. `date` is an ISO day. */
export type DailyPoint = {
  date: string;
  tryOns: number;
  bookings: number;
  searches: number;
};

/** Minimal shape a style needs to be ranked. Both NailStyleCard and PublishedMerchantStyle satisfy it. */
export type RankCandidate = {
  id: string;
  discoveryFacets: StyleDiscoveryFacet[];
  publishedAt?: string | null;
};

export type RankedStyle<T extends RankCandidate = RankCandidate> = {
  style: T;
  score: number;
  /** Machine-readable why: ['tag:裸色', 'tag:法式风', 'popular', 'fresh']. */
  reasonCodes: string[];
  /** Human why: 'Matches your 裸色 · 法式风'. */
  reasonText: string;
};

export type AppointmentContext = {
  bookingId: string;
  styleTitle: string;
  startAt: string;
  status: string;
} | null;

export type CustomerIntelligence<T extends RankCandidate = RankCandidate> = {
  profile: CustomerProfile;
  recommendations: RankedStyle<T>[];
  appointmentContext: AppointmentContext;
};
