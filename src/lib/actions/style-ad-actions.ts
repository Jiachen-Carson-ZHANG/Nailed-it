'use server';

import type {
  StyleAdCenterSnapshot,
  StyleAdStatus,
  StyleAdView,
  PromotionGoal,
  AudienceMode,
  StyleAdCustomAudience,
  ProposeStyleAdInput,
  ProposeStyleAdResult,
  CampaignHypothesis,
} from '@/domain/style-ad';
import { styleAdWithdrawTarget } from '@/domain/action-entity-contract';
import {
  DEFAULT_TARGET_EXPOSURE,
  DEFAULT_TARGET_ROI,
  DEFAULT_DURATION_DAYS,
  DEFAULT_CUSTOM_AUDIENCE,
  AGENT_AUTO_LAUNCH_MAX_DAILY_BUDGET_CENTS,
  clampTargetExposure,
  clampDurationDays,
  normalizeCustomAudience,
} from '@/domain/style-ad';
import type { MerchantStyleView } from '@/domain/merchant-style';
import { createMerchantStyleService } from '@/lib/services/merchant-style-service';
import { createQuoteService } from '@/lib/services/quote-service';
import { getRepositories } from '@/lib/repositories';
import { usesSupabaseBackend, getServiceClient } from '@/lib/db/client';
import { getStyleMediaStorage } from '@/lib/storage';
import { demoMerchantId } from '@/mock/merchants';
import {
  getMockStyleAdView,
  mockActiveStyleAdIds,
  mockStyleAdCenterSnapshot,
} from '@/mock/style-ads';

/** Parse a place_ad action's `payload.hypothesis` (the sandbox forecast snapshot) into the center's
 *  compact shape. Tolerant: the Python writes `expectedCostPerBookingCents`; a missing/old shape → null. */
function extractHypothesis(payload: Record<string, unknown> | null | undefined): CampaignHypothesis | null {
  const h = (payload as { hypothesis?: unknown } | null | undefined)?.hypothesis;
  if (!h || typeof h !== 'object') return null;
  const rec = h as Record<string, unknown>;
  const bookings = rec.expectedBookings;
  if (!Array.isArray(bookings) || bookings.length < 2) return null;
  const cac = rec.expectedCostPerBookingCents;
  return {
    expectedBookings: [Number(bookings[0]) || 0, Number(bookings[1]) || 0],
    expectedCacCents: Array.isArray(cac) && cac.length >= 2 ? [Number(cac[0]) || 0, Number(cac[1]) || 0] : null,
  };
}

type StyleAdCampaignRow = {
  id: string;
  merchant_id: string;
  merchant_style_id: string;
  status: StyleAdView['status'];
  promotion_goal: PromotionGoal;
  target_exposure: number;
  target_roi: number;
  start_at: string | null;
  daily_budget_cents: number | null;
  duration_days: number | null;
  audience_mode: AudienceMode;
  custom_audience: StyleAdCustomAudience | Record<string, unknown> | null;
  notes: string | null;
  impressions: number;
  clicks: number;
  bookings: number;
  spend_cents: number;
  updated_at: string;
  source_run_id: string | null;
};

type LaunchStyleAdInput = {
  styleId: string;
  promotionGoal?: PromotionGoal;
  targetExposure?: number;
  targetRoi?: number;
  startAt?: string | null;
  durationDays?: number;
  audienceMode?: AudienceMode;
  customAudience?: StyleAdCustomAudience;
  dailyBudgetCents?: number;
  notes?: string;
};

function getMerchantStyleService() {
  const repos = getRepositories();
  return createMerchantStyleService(repos.merchantStyles, getStyleMediaStorage(), createQuoteService(repos));
}

function isMissingStyleAdTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: string }).code) : '';
  const message = 'message' in error ? String((error as { message?: string }).message) : '';
  if (code === '42P01' || code === 'PGRST205') return true;
  return /style_ad_campaign/i.test(message)
    && /(does not exist|schema cache|could not find the table)/i.test(message);
}

async function listCampaignRows(): Promise<StyleAdCampaignRow[]> {
  const { data, error } = await getServiceClient()
    .from('style_ad_campaign')
    .select('*')
    .eq('merchant_id', demoMerchantId)
    .order('updated_at', { ascending: false });
  if (error) {
    if (isMissingStyleAdTableError(error)) return [];
    throw new Error(`StyleAdCampaign.list failed: ${error.message}`);
  }
  return (data ?? []) as StyleAdCampaignRow[];
}

async function getCampaignRow(styleId: string): Promise<StyleAdCampaignRow | null> {
  const { data, error } = await getServiceClient()
    .from('style_ad_campaign')
    .select('*')
    .eq('merchant_id', demoMerchantId)
    .eq('merchant_style_id', styleId)
    .maybeSingle();
  if (error) {
    if (isMissingStyleAdTableError(error)) return null;
    throw new Error(`StyleAdCampaign.get failed: ${error.message}`);
  }
  return data as StyleAdCampaignRow | null;
}

async function upsertCampaignRow(input: Required<LaunchStyleAdInput>): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await getServiceClient()
    .from('style_ad_campaign')
    .upsert(
      {
        id: `ad-${input.styleId}`,
        merchant_id: demoMerchantId,
        merchant_style_id: input.styleId,
        status: 'active',
        promotion_goal: input.promotionGoal,
        target_exposure: input.targetExposure,
        target_roi: input.targetRoi,
        start_at: input.startAt,
        daily_budget_cents: input.dailyBudgetCents,
        duration_days: input.durationDays,
        audience_mode: input.audienceMode,
        custom_audience: input.customAudience,
        notes: input.notes,
        updated_at: now,
      },
      { onConflict: 'merchant_id,merchant_style_id' },
    );
  if (error) {
    if (isMissingStyleAdTableError(error)) {
      throw new Error('style_ad_campaign_table_missing');
    }
    throw new Error(`StyleAdCampaign.launch failed: ${error.message}`);
  }
}

function campaignToView(style: MerchantStyleView | null, campaign: StyleAdCampaignRow | null): StyleAdView | null {
  if (!style || style.status !== 'published') return null;
  return {
    id: campaign?.id ?? `ad-draft-${style.id}`,
    styleId: style.id,
    styleTitle: style.title,
    styleImageUrl: style.imageUrl,
    status: campaign?.status ?? 'draft',
    promotionGoal: campaign?.promotion_goal ?? 'homepage_exposure',
    targetExposure: campaign?.target_exposure ?? DEFAULT_TARGET_EXPOSURE,
    targetRoi: Number(campaign?.target_roi ?? DEFAULT_TARGET_ROI),
    startAt: campaign?.start_at ?? null,
    durationDays: campaign?.duration_days ?? DEFAULT_DURATION_DAYS,
    audienceMode: campaign?.audience_mode ?? 'smart',
    customAudience: normalizeCustomAudience(campaign?.custom_audience),
    dailyBudgetCents: campaign?.daily_budget_cents ?? null,
    notes: campaign?.notes ?? '',
    updatedAt: campaign?.updated_at ?? style.updatedAt,
    bookingValueCents: style.previewPriceCents ?? 0,
  };
}

export async function listActiveStyleAdIdsAction(): Promise<string[]> {
  if (usesSupabaseBackend()) {
    const rows = await listCampaignRows();
    return rows.filter((row) => row.status === 'active').map((row) => row.merchant_style_id);
  }
  return [...mockActiveStyleAdIds];
}

export async function getStyleAdCenterSnapshotAction(): Promise<StyleAdCenterSnapshot> {
  if (usesSupabaseBackend()) {
    const [styles, campaigns, adActions] = await Promise.all([
      getMerchantStyleService().listMerchant(demoMerchantId),
      listCampaignRows(),
      // The launch forecast lives on the place_ad action's payload.hypothesis (keyed to the campaign by
      // entity_id) — pull it so the center can show 预测 vs 实际.
      getRepositories().agents.listActions(demoMerchantId, { types: ['place_ad'], statuses: ['applied'] }),
    ]);
    const styleById = new Map(styles.map((style) => [style.id, style]));
    const hypByCampaign = new Map<string, CampaignHypothesis>();
    for (const action of adActions) { // listActions is newest-first — first snapshot per campaign wins
      if (!action.entityId || hypByCampaign.has(action.entityId)) continue;
      const hyp = extractHypothesis(action.payload);
      if (hyp) hypByCampaign.set(action.entityId, hyp);
    }
    const summaries = campaigns.flatMap((campaign) => {
      const style = styleById.get(campaign.merchant_style_id);
      if (!style || style.status !== 'published') return [];
      return [{
        id: campaign.id,
        styleId: style.id,
        styleTitle: style.title,
        styleImageUrl: style.imageUrl,
        status: campaign.status,
        dailyBudgetCents: campaign.daily_budget_cents,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        bookings: campaign.bookings,
        spendCents: campaign.spend_cents,
        updatedAt: campaign.updated_at,
        sourceRunId: campaign.source_run_id ?? null,
        hypothesis: hypByCampaign.get(campaign.id) ?? null,
      }];
    });
    return {
      activeCampaigns: summaries.filter((row) => row.status === 'active').length,
      totalImpressions: summaries.reduce((sum, row) => sum + row.impressions, 0),
      totalClicks: summaries.reduce((sum, row) => sum + row.clicks, 0),
      totalBookings: summaries.reduce((sum, row) => sum + row.bookings, 0),
      totalSpendCents: summaries.reduce((sum, row) => sum + row.spendCents, 0),
      campaigns: summaries,
    };
  }
  return structuredClone(mockStyleAdCenterSnapshot);
}

export async function getStyleAdAction(styleId: string): Promise<StyleAdView | null> {
  if (usesSupabaseBackend()) {
    const [style, campaign] = await Promise.all([
      getMerchantStyleService().getMerchant(demoMerchantId, styleId),
      getCampaignRow(styleId),
    ]);
    return campaignToView(style, campaign);
  }
  const view = getMockStyleAdView(styleId);
  return view ? structuredClone(view) : null;
}

export async function launchStyleAdAction(input: LaunchStyleAdInput): Promise<StyleAdView> {
  const payload: Required<LaunchStyleAdInput> = {
    styleId: input.styleId,
    promotionGoal: input.promotionGoal ?? 'homepage_exposure',
    targetExposure: clampTargetExposure(input.targetExposure ?? DEFAULT_TARGET_EXPOSURE),
    targetRoi: input.targetRoi ?? DEFAULT_TARGET_ROI,
    startAt: input.startAt ?? null,
    durationDays: clampDurationDays(input.durationDays ?? DEFAULT_DURATION_DAYS),
    audienceMode: input.audienceMode ?? 'smart',
    customAudience: normalizeCustomAudience(input.customAudience ?? DEFAULT_CUSTOM_AUDIENCE),
    dailyBudgetCents: input.dailyBudgetCents ?? 3500,
    notes: input.notes ?? '',
  };

  if (usesSupabaseBackend()) {
    const style = await getMerchantStyleService().getMerchant(demoMerchantId, payload.styleId);
    if (!style || style.status !== 'published') throw new Error('merchant_style_not_publishable_for_ads');
    await upsertCampaignRow(payload);
    const campaign = await getCampaignRow(payload.styleId);
    const view = campaignToView(style, campaign);
    if (!view) throw new Error('style_ad_not_found_after_launch');
    return view;
  }

  const view = getMockStyleAdView(payload.styleId);
  if (!view) throw new Error('merchant_style_not_publishable_for_ads');
  return {
    ...structuredClone(view),
    status: 'active',
    promotionGoal: payload.promotionGoal,
    targetExposure: payload.targetExposure,
    targetRoi: payload.targetRoi,
    startAt: payload.startAt,
    durationDays: payload.durationDays,
    audienceMode: payload.audienceMode,
    customAudience: payload.customAudience,
    dailyBudgetCents: payload.dailyBudgetCents,
    notes: payload.notes,
  };
}

// ── Agent-proposed campaigns (ADR-0012 Phase 2) ────────────────────────────────────────────────
// The 投广 agent no longer writes a fire-and-forget log row: it creates a REAL StyleAd campaign linked back
// to the run that proposed it. Envelope (ADR-0012 §2): inside the merchant's per-campaign budget cap the
// agent auto-launches (ad spend is a withdrawable daily drip); above it the campaign stays a draft for the
// merchant to launch from 投广中心. The caller writes the agent_action with entity_id = the returned id.
// The cap + types live in domain/style-ad.ts — a 'use server' module may only export async functions.

export async function proposeStyleAdAction(input: ProposeStyleAdInput): Promise<ProposeStyleAdResult> {
  const id = `ad-${input.styleId}`;
  const status: ProposeStyleAdResult['status'] =
    input.dailyBudgetCents <= AGENT_AUTO_LAUNCH_MAX_DAILY_BUDGET_CENTS ? 'active' : 'draft';

  if (!usesSupabaseBackend()) return { id, status }; // memory/dev: no campaign table to write

  const style = await getMerchantStyleService().getMerchant(demoMerchantId, input.styleId);
  if (!style || style.status !== 'published') throw new Error('merchant_style_not_publishable_for_ads');

  const { error } = await getServiceClient()
    .from('style_ad_campaign')
    .upsert(
      {
        id,
        merchant_id: demoMerchantId,
        merchant_style_id: input.styleId,
        status,
        daily_budget_cents: input.dailyBudgetCents,
        source_run_id: input.sourceRunId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
  if (error) {
    // Check the column BEFORE the table guard: isMissingStyleAdTableError matches any message containing
    // 'style_ad_campaign' + 'schema cache', so a missing COLUMN would otherwise be misreported as a
    // missing TABLE. 0027's ALTER is guarded, so a DB that got the ad tables later lacks source_run_id.
    if (/source_run_id/i.test(error.message)) {
      throw new Error(`style_ad_campaign.source_run_id missing — apply migration 0028_style_ad_source_run.sql (${error.message})`);
    }
    if (isMissingStyleAdTableError(error)) {
      throw new Error('style_ad_campaign missing — apply migrations 0022_style_ad_campaign + 0023-0025');
    }
    throw new Error(`StyleAdCampaign.propose failed: ${error.message}`);
  }
  return { id, status };
}

/** Withdraw a campaign: `active → paused` (resumable), `draft → ended` (a declined proposal). This is what
 *  undoing a 投广 action must call — flipping agent_actions.status alone would leave the ad spending money.
 *  Returns the entity's new status, or null when it was already not live (a no-op, not a failure). */
export async function withdrawStyleAdCampaignAction(campaignId: string): Promise<StyleAdStatus | null> {
  if (!usesSupabaseBackend()) return null; // memory/dev: no campaign table to withdraw

  const { data, error } = await getServiceClient()
    .from('style_ad_campaign')
    .select('status')
    .eq('id', campaignId)
    .eq('merchant_id', demoMerchantId)
    .maybeSingle();
  if (error) throw new Error(`StyleAdCampaign.withdraw read failed: ${error.message}`);
  if (!data) return null;

  const target = styleAdWithdrawTarget((data as { status: StyleAdStatus }).status);
  if (target === null) return null;

  const { error: updateError } = await getServiceClient()
    .from('style_ad_campaign')
    .update({ status: target, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('merchant_id', demoMerchantId);
  if (updateError) throw new Error(`StyleAdCampaign.withdraw failed: ${updateError.message}`);
  return target;
}
