'use server';

import type { StyleAdCenterSnapshot, StyleAdView } from '@/domain/style-ad';
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

type StyleAdCampaignRow = {
  id: string;
  merchant_id: string;
  merchant_style_id: string;
  status: StyleAdView['status'];
  daily_budget_cents: number | null;
  duration_days: number | null;
  notes: string | null;
  impressions: number;
  clicks: number;
  bookings: number;
  spend_cents: number;
  updated_at: string;
};

type LaunchStyleAdInput = {
  styleId: string;
  dailyBudgetCents?: number;
  durationDays?: number;
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
        daily_budget_cents: input.dailyBudgetCents,
        duration_days: input.durationDays,
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
    dailyBudgetCents: campaign?.daily_budget_cents ?? null,
    durationDays: campaign?.duration_days ?? null,
    notes: campaign?.notes ?? '',
    updatedAt: campaign?.updated_at ?? style.updatedAt,
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
    const [styles, campaigns] = await Promise.all([
      getMerchantStyleService().listMerchant(demoMerchantId),
      listCampaignRows(),
    ]);
    const styleById = new Map(styles.map((style) => [style.id, style]));
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
    dailyBudgetCents: input.dailyBudgetCents ?? 3500,
    durationDays: input.durationDays ?? 7,
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
    dailyBudgetCents: payload.dailyBudgetCents,
    durationDays: payload.durationDays,
    notes: payload.notes,
  };
}
