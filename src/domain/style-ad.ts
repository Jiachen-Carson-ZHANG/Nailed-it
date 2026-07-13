export const styleAdStatuses = ['draft', 'active', 'paused', 'ended'] as const;

export type StyleAdStatus = (typeof styleAdStatuses)[number];

export const promotionGoals = ['homepage_exposure', 'booking_conversion'] as const;

export type PromotionGoal = (typeof promotionGoals)[number];

export const exposureTargetPresets = [5000, 10000, 20000, 50000, 100000] as const;

export const DEFAULT_TARGET_EXPOSURE = 5000;
export const MIN_TARGET_EXPOSURE = 1000;
export const MAX_TARGET_EXPOSURE = 1_000_000;
export const DEFAULT_TARGET_ROI = 2.0;
export const MIN_TARGET_ROI = 1.0;
export const MAX_TARGET_ROI = 10.0;

export function isExposurePreset(value: number): value is (typeof exposureTargetPresets)[number] {
  return (exposureTargetPresets as readonly number[]).includes(value);
}

export function clampTargetExposure(value: number): number {
  return Math.min(MAX_TARGET_EXPOSURE, Math.max(MIN_TARGET_EXPOSURE, Math.round(value)));
}

export const audienceModes = ['smart', 'custom'] as const;

export type AudienceMode = (typeof audienceModes)[number];

export const consumptionLevels = ['high', 'medium', 'low'] as const;

export type ConsumptionLevel = (typeof consumptionLevels)[number];

export const styleAdPreferenceTags = [
  'minimal',
  'rhinestone',
  'extension',
  'hand_paint',
  'french',
  'cat_eye',
  'y2k',
  'solid',
  'complex',
] as const;

export type StyleAdPreferenceTag = (typeof styleAdPreferenceTags)[number];

export type StyleAdCustomAudience = {
  ageMin: number;
  ageMax: number;
  visitFrequency: ConsumptionLevel | null;
  unitPrice: ConsumptionLevel | null;
  preferenceTags: StyleAdPreferenceTag[];
};

export const MIN_AUDIENCE_AGE = 18;
export const MAX_AUDIENCE_AGE = 60;
export const DEFAULT_DURATION_DAYS = 7;
export const MIN_DURATION_DAYS = 1;
export const MAX_DURATION_DAYS = 30;

export const DEFAULT_CUSTOM_AUDIENCE: StyleAdCustomAudience = {
  ageMin: 22,
  ageMax: 35,
  visitFrequency: null,
  unitPrice: null,
  preferenceTags: [],
};

export function isConsumptionLevel(value: unknown): value is ConsumptionLevel {
  return typeof value === 'string' && (consumptionLevels as readonly string[]).includes(value);
}

export function isStyleAdPreferenceTag(value: unknown): value is StyleAdPreferenceTag {
  return typeof value === 'string' && (styleAdPreferenceTags as readonly string[]).includes(value);
}

export function clampAudienceAge(value: number): number {
  return Math.min(MAX_AUDIENCE_AGE, Math.max(MIN_AUDIENCE_AGE, Math.round(value)));
}

export function clampDurationDays(value: number): number {
  return Math.min(MAX_DURATION_DAYS, Math.max(MIN_DURATION_DAYS, Math.round(value)));
}

export function normalizeCustomAudience(raw: unknown): StyleAdCustomAudience {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CUSTOM_AUDIENCE, preferenceTags: [] };
  }
  const record = raw as Record<string, unknown>;
  let ageMin = clampAudienceAge(Number(record.ageMin) || DEFAULT_CUSTOM_AUDIENCE.ageMin);
  let ageMax = clampAudienceAge(Number(record.ageMax) || DEFAULT_CUSTOM_AUDIENCE.ageMax);
  if (ageMin > ageMax) {
    [ageMin, ageMax] = [ageMax, ageMin];
  }
  return {
    ageMin,
    ageMax,
    visitFrequency: isConsumptionLevel(record.visitFrequency) ? record.visitFrequency : null,
    unitPrice: isConsumptionLevel(record.unitPrice) ? record.unitPrice : null,
    preferenceTags: Array.isArray(record.preferenceTags)
      ? record.preferenceTags.filter(isStyleAdPreferenceTag)
      : [],
  };
}

export function minFutureDateInputValue(from = new Date()): string {
  const next = new Date(from);
  next.setDate(next.getDate() + 1);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The forecast the campaign was launched on (place_ad `payload.hypothesis`) — lets the center show
 *  预测 vs 实际, i.e. the sandbox promise against measured delivery. Null for merchant-authored campaigns
 *  (no agent forecast) or pre-hypothesis rows. */
export type CampaignHypothesis = {
  expectedBookings: [number, number];
  expectedCacCents: [number, number] | null;
};

export type ForecastVerdict = 'below' | 'within' | 'above';

/** Did measured bookings land inside the forecast band? The 打脸 signal made explicit. */
export function forecastVerdict(h: CampaignHypothesis, deliveredBookings: number): ForecastVerdict {
  if (deliveredBookings < h.expectedBookings[0]) return 'below';
  if (deliveredBookings > h.expectedBookings[1]) return 'above';
  return 'within';
}

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
  /** The agent run that proposed this campaign — null = merchant-authored (ADR-0012 backward link). */
  sourceRunId: string | null;
  /** The launch forecast for 预测 vs 实际 — null when merchant-authored or no snapshot. */
  hypothesis: CampaignHypothesis | null;
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
  promotionGoal: PromotionGoal;
  targetExposure: number;
  targetRoi: number;
  startAt: string | null;
  durationDays: number;
  audienceMode: AudienceMode;
  customAudience: StyleAdCustomAudience;
  dailyBudgetCents: number | null;
  notes: string;
  updatedAt: string;
  /** The style's per-booking value (its priced quote) — drives the forecast ROI. 0 when unpriced. */
  bookingValueCents: number;
};

// ── Agent-proposed campaigns (ADR-0012 Phase 2) ────────────────────────────────────────────────
// These live here, not in style-ad-actions.ts, because a 'use server' module may only export async
// functions — exporting a const from one breaks the build.

/** Per-campaign daily budget the agent may auto-launch without asking (the merchant's envelope). Above it
 *  the campaign stays a draft for the merchant to launch in 投广中心. Becomes merchant policy later. */
export const AGENT_AUTO_LAUNCH_MAX_DAILY_BUDGET_CENTS = 5_000; // ¥50/day

export type ProposeStyleAdInput = { styleId: string; dailyBudgetCents: number; sourceRunId: string | null };
export type ProposeStyleAdResult = { id: string; status: 'draft' | 'active' };
