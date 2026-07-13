// Ad forecast — the pre-launch promise from observable priors only (ranges, never point estimates).
//
// This is a faithful TS port of the agent sandbox's `forecast()` (agent-service/nailed_agents/sandbox.py,
// ADR-0016). Porting it here is the point of the "sandbox into the current UI" integration: the merchant's
// 投广 editor and the 投广 Agent now compute the SAME forecast from the SAME public priors — the agent is
// just a merchant who reads faster. It sees only observable priors (audience CPC/CTR/intent, the style's
// historical CVR, fatigue); the hidden scenario state that makes reality diverge lives ONLY in the Python
// sandbox and is never modelled here (that divergence is what the 广告中心 "实际 vs 预测" then reveals).

import type { AudienceMode, StyleAdCustomAudience } from './style-ad';
import { MIN_AUDIENCE_AGE, MAX_AUDIENCE_AGE } from './style-ad';

export type AdAudience = 'broad_local_interest' | 'saved_or_viewed' | 'try_on_no_booking';

type AudiencePrior = {
  size: number;
  baseCtr: number;
  intentFactor: number;
  baseCpcCents: number;
  label: { 'zh-CN': string; en: string };
  hint: { 'zh-CN': string; en: string };
};

export const AD_AUDIENCES: Record<AdAudience, AudiencePrior> = {
  broad_local_interest: {
    size: 5000, baseCtr: 0.018, intentFactor: 0.35, baseCpcCents: 85,
    label: { 'zh-CN': '本地泛兴趣', en: 'Broad local interest' },
    hint: { 'zh-CN': '覆盖大、意向浅，适合造势', en: 'wide reach, low intent — awareness' },
  },
  saved_or_viewed: {
    size: 1200, baseCtr: 0.032, intentFactor: 0.80, baseCpcCents: 95,
    label: { 'zh-CN': '收藏/浏览过', en: 'Saved or viewed' },
    hint: { 'zh-CN': '近 30 天收藏或看过详情', en: 'saved/viewed in the last 30d' },
  },
  try_on_no_booking: {
    size: 450, baseCtr: 0.045, intentFactor: 1.60, baseCpcCents: 110,
    label: { 'zh-CN': '试戴未预约', en: 'Tried on, no booking' },
    hint: { 'zh-CN': '近 14 天试戴未预约 · 量小意向强', en: 'tried on, not booked · small, high intent' },
  },
};

export const AD_AUDIENCE_ORDER: AdAudience[] = ['broad_local_interest', 'saved_or_viewed', 'try_on_no_booking'];

const RANGE = 0.20; // ±20% forecast band — ranges, never magic point estimates
/** Default click→booking rate when a style has no measured funnel yet (the sandbox reads this from the
 *  briefing; the merchant editor derives it from the style's intelligence, else falls back to this). */
export const DEFAULT_STYLE_CVR = 0.06;

export type AdForecast = {
  audience: AdAudience;
  expectedImpressions: [number, number];
  expectedClicks: [number, number];
  expectedBookings: [number, number];
  expectedCacCents: [number, number] | null; // cost per booking; null when <~0 bookings
  saturation: 'low' | 'medium' | 'high';
  confidence: number;
  warnings: Array<{ 'zh-CN': string; en: string }>;
};

export type AdForecastInput = {
  audience: AdAudience;
  totalBudgetCents: number;
  durationDays: number;
  /** the style's historical click→booking rate (0..1). */
  styleCvr?: number;
  competition?: number; // PUBLIC market-season prior (not the hidden multiplier)
  /** Demographic narrowing (0..1) applied on top of the behavioral pool: a tighter 年龄/标签 filter
   *  shrinks the reachable size, so the same budget hits higher frequency → more saturation / worse CAC.
   *  It scales REACH only — per-click CVR is behavioral (the pool), not demographic. Default 1 (no filter). */
  audienceSizeMultiplier?: number;
};

function band(x: number): [number, number] {
  return [Math.max(0, Math.round(x * (1 - RANGE))), Math.max(0, Math.round(x * (1 + RANGE)))];
}

/** Demographic narrowing (0..1): a tighter 年龄/标签/频次/单价 filter shrinks reachable size. */
export function audienceReach(custom: StyleAdCustomAudience): number {
  const ageFrac = Math.max(1, custom.ageMax - custom.ageMin) / (MAX_AUDIENCE_AGE - MIN_AUDIENCE_AGE);
  const tagNarrow = 0.75 ** custom.preferenceTags.length;
  const freqNarrow = custom.visitFrequency ? 0.8 : 1;
  const priceNarrow = custom.unitPrice ? 0.8 : 1;
  return Math.min(1, Math.max(0.08, ageFrac * tagNarrow * freqNarrow * priceNarrow));
}

/**
 * Map the merchant's audience UI to the sandbox's forecast inputs — the honest bridge between the two
 * vocabularies. Behavioral POOL (funnel stage → CTR/CVR/CAC) comes from purchase-intent signals
 * (消费习惯/标签); the demographic filter (年龄/标签 count) only narrows REACH. 智能推荐 = the platform
 * auto-selects engaged, likely-to-book users → the mid engaged pool at full reach.
 */
export function deriveAdAudience(mode: AudienceMode, custom?: StyleAdCustomAudience): { pool: AdAudience; reachMultiplier: number } {
  if (mode !== 'custom' || !custom) return { pool: 'saved_or_viewed', reachMultiplier: 1 };
  const highIntent = custom.visitFrequency === 'high' || custom.unitPrice === 'high';
  const someSignal = !!custom.visitFrequency || !!custom.unitPrice || custom.preferenceTags.length > 0;
  const pool: AdAudience = highIntent ? 'try_on_no_booking' : someSignal ? 'saved_or_viewed' : 'broad_local_interest';
  return { pool, reachMultiplier: audienceReach(custom) };
}

/** Forecast ROI band = booking value × expected bookings ÷ spend. Needs the style's per-booking value. */
export function forecastRoi(f: AdForecast, bookingValueCents: number, spendCents: number): [number, number] | null {
  if (spendCents <= 0 || bookingValueCents <= 0) return null;
  const lo = (f.expectedBookings[0] * bookingValueCents) / spendCents;
  const hi = (f.expectedBookings[1] * bookingValueCents) / spendCents;
  return [Number(lo.toFixed(1)), Number(hi.toFixed(1))];
}

function fatigue(impressions: number, audienceSize: number): number {
  const freq = impressions / Math.max(audienceSize, 1);
  if (freq <= 2.0) return 1.0;
  if (freq <= 3.0) return 0.85;
  return 0.65;
}

const WARN = {
  saturated: { 'zh-CN': '受众已饱和：继续加预算主要买到重复曝光，获客成本会变差。', en: 'Audience saturated: more budget mostly buys repeat impressions, CAC worsens.' },
  underOne: { 'zh-CN': '该配置预计不足 1 个预约——目标大概率无法通过此方案达成。', en: 'Under ~1 booking forecast — this target likely isn’t reachable this way.' },
  tooShort: { 'zh-CN': '投放期过短，实测样本可能不足以判断效果。', en: 'Run too short — the measured sample may be too small to judge.' },
};

/** Pure forecast. Same math as the sandbox: budget → clicks (CPC) → impressions (CTR) → fatigue-adjusted
 *  CVR → bookings, all widened to ±20% bands. */
export function forecastAd(input: AdForecastInput): AdForecast {
  const a = AD_AUDIENCES[input.audience];
  const cvr0 = input.styleCvr ?? DEFAULT_STYLE_CVR;
  const competition = input.competition ?? 1.0;

  // Demographic filter shrinks reach only (behavioral CVR is unchanged). Clamp so a very tight filter
  // can't make the pool vanish.
  const effSize = Math.max(50, a.size * Math.min(1, Math.max(0.05, input.audienceSizeMultiplier ?? 1)));

  const cpc = a.baseCpcCents * competition;
  const clicks = input.totalBudgetCents / cpc;
  const impressions = clicks / a.baseCtr;
  const cvr = cvr0 * a.intentFactor * fatigue(impressions, effSize);
  const bookings = clicks * cvr;
  const cac = bookings > 0.05 ? input.totalBudgetCents / bookings : null;

  const freq = impressions / effSize;
  const saturation: AdForecast['saturation'] = freq <= 1.5 ? 'low' : freq <= 2.5 ? 'medium' : 'high';
  const warnings: AdForecast['warnings'] = [];
  if (saturation === 'high') warnings.push(WARN.saturated);
  if (bookings < 1.0) warnings.push(WARN.underOne);
  if (input.durationDays < 2) warnings.push(WARN.tooShort);

  return {
    audience: input.audience,
    expectedImpressions: band(impressions),
    expectedClicks: band(clicks),
    expectedBookings: [Number((bookings * (1 - RANGE)).toFixed(1)), Number((bookings * (1 + RANGE)).toFixed(1))],
    expectedCacCents: cac === null ? null : band(cac),
    saturation,
    confidence: saturation === 'high' ? 0.55 : 0.72,
    warnings,
  };
}
