// Merchant-readable descriptions of agent transcripts (ADR-0007 / ADR-0012, UI-alignment pass).
// The transcript steps the Python service writes are developer exhaust — tool names + raw JSON I/O.
// A merchant cannot read `{"errors":[],"capacity":{...` , so every surface that shows a thinking chain
// renders THROUGH this module: a per-tool one-sentence summary in the merchant's language, with the raw
// payload demoted to an expandable detail. Pure + tested; the React side stays a dumb renderer.

import type { AgentAction, AgentActionType, TranscriptStep } from './agents';
import { getMerchantManagePath } from './session';

export type AppLang = 'zh-CN' | 'en';

export type StepDescription = {
  /** Short pill text, e.g. 决策大脑 / 投广 — the step's type identity. */
  label: string;
  /** One human sentence with the numbers that matter. Never raw JSON. */
  summary: string;
  /** Compact raw payload for the "查看数据" expander; null when there is nothing beyond the summary. */
  detail: string | null;
};

const MAX_DETAIL_CHARS = 4000;

// ── small helpers ──────────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function money(cents: unknown, currency = 'SGD'): string {
  const n = typeof cents === 'number' ? cents : Number(cents);
  if (!Number.isFinite(n)) return '—';
  const units = n / 100;
  return `${currency} ${Number.isInteger(units) ? units : units.toFixed(1)}`;
}

/** '款式 8284' for machine ids like style-melissa-img-8284; short human ids pass through as-is. */
export function styleLabel(id: unknown, lang: AppLang): string {
  const s = String(id ?? '').trim();
  if (!s) return '—';
  const trailingDigits = /(\d{3,})$/.exec(s)?.[1];
  const core = trailingDigits ?? (s.length > 18 ? s.replace(/^style-/, '') : s);
  return lang === 'zh-CN' ? `款式 ${core}` : `style ${core}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function compactJson(value: unknown, max = 120): string {
  if (value == null) return '';
  if (typeof value === 'string') return truncate(value, max);
  try { return truncate(JSON.stringify(value), max); } catch { return truncate(String(value), max); }
}

function rawDetail(input: unknown, output: unknown): string | null {
  const both = { input: input ?? null, output: output ?? null };
  if (both.input === null && both.output === null) return null;
  try {
    const s = JSON.stringify(both, null, 2);
    return s.length > MAX_DETAIL_CHARS ? `${s.slice(0, MAX_DETAIL_CHARS)}\n… (truncated)` : s;
  } catch { return null; }
}

const count = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

// ── tool-call descriptions ─────────────────────────────────────────────────────

const AD_SLOTS: Record<string, { 'zh-CN': string; en: string }> = {
  top_funnel: { 'zh-CN': '首页推荐位', en: 'home feature' },
  mid_funnel: { 'zh-CN': '中部曝光位', en: 'mid exposure' },
  lower_funnel: { 'zh-CN': '详情页转化位', en: 'detail conversion' },
};

const slotLabel = (slot: unknown, lang: AppLang): string =>
  AD_SLOTS[String(slot)]?.[lang] ?? String(slot ?? '');

type Summarizer = (input: Record<string, unknown>, output: unknown, lang: AppLang) => { label: string; summary: string };

/** The 决策大脑 payload: count candidates + quote utilization so the sentence carries the verdict. */
function summarizeDecisions(_input: Record<string, unknown>, output: unknown, lang: AppLang) {
  const o = isObj(output) ? output : {};
  const decisions = Array.isArray(o.decisions) ? (o.decisions as Array<{ candidate?: string }>) : [];
  const by = (c: string) => decisions.filter((d) => d.candidate === c).length;
  const util = isObj(o.capacity) ? Math.round(Number(o.capacity.utilizationPct) || 0) : null;
  const zh = lang === 'zh-CN';
  const label = zh ? '决策大脑' : 'Decision brain';
  if (decisions.length === 0) return { label, summary: zh ? '读取每款经营分析' : 'Read per-style analysis' };
  const parts = zh
    ? `${decisions.length} 款分析：投广候选 ${by('ad')} · 团购候选 ${by('coupon')} · 只展示 ${by('display_only')} · 暂缓 ${by('skip')}`
    : `${decisions.length} styles: ad ${by('ad')} · coupon ${by('coupon')} · display ${by('display_only')} · skip ${by('skip')}`;
  const cap = util === null ? '' : zh ? ` · 下周产能 ${util}%` : ` · next-week utilization ${util}%`;
  return { label, summary: parts + cap };
}

const SUMMARIZERS: Record<string, Summarizer> = {
  get_style_business_decisions: summarizeDecisions,

  get_merchant_insights: (input, output, lang) => {
    const headline = isObj(output) ? String((output as { headline?: unknown }).headline ?? '') : '';
    const days = Number(input.rangeDays) || 7;
    const zh = lang === 'zh-CN';
    return {
      label: zh ? '经营简报' : 'Briefing',
      summary: headline || (zh ? `读取近 ${days} 天经营数据` : `Read the last ${days} days of shop data`),
    };
  },

  get_customer_intelligence: (_i, output, lang) => {
    const n = isObj(output) ? count((output as { customers?: unknown }).customers) || count(output) : count(output);
    const zh = lang === 'zh-CN';
    return { label: zh ? '客户画像' : 'Customers', summary: zh ? `读取 ${n || '若干'} 位重点客户画像` : `Read ${n || 'key'} customer profiles` };
  },

  get_external_trends: (input, output, lang) => {
    const n = isObj(output) ? count((output as { trends?: unknown }).trends) || count(output) : count(output);
    const zh = lang === 'zh-CN';
    return { label: zh ? '站外趋势' : 'External trends', summary: zh ? `获取站外趋势 ${n ? `${n} 条` : ''}（${String(input.trendType ?? 'growing')}）` : `Fetched ${n || ''} external trends (${String(input.trendType ?? 'growing')})` };
  },

  get_platform_hot: (_i, output, lang) => {
    const n = isObj(output) ? count((output as { hot?: unknown }).hot) || count(output) : count(output);
    const zh = lang === 'zh-CN';
    return { label: zh ? '平台热榜' : 'Platform hot', summary: zh ? `读取平台热榜${n ? ` ${n} 条` : ''}` : `Read platform hot list${n ? ` (${n})` : ''}` };
  },

  get_trend_opportunities: (_i, output, lang) => {
    const o = isObj(output) ? output : {};
    const opps = Array.isArray(o.opportunities) ? (o.opportunities as Array<{ action?: string }>) : [];
    const by = (a: string) => opps.filter((x) => x.action === a).length;
    const zh = lang === 'zh-CN';
    if (opps.length === 0) return { label: zh ? '选品机会' : 'Opportunities', summary: zh ? '匹配趋势与库内款式' : 'Matched trends against the library' };
    return {
      label: zh ? '选品机会' : 'Opportunities',
      summary: zh
        ? `${opps.length} 个机会：放大 ${by('amplify')} · 试价 ${by('price_test')} · 缺口 ${by('gap')} · 下架 ${by('prune')}`
        : `${opps.length} opportunities: amplify ${by('amplify')} · price ${by('price_test')} · gap ${by('gap')} · prune ${by('prune')}`,
    };
  },

  get_catalog_actions: (_i, output, lang) => {
    const o = isObj(output) ? output : {};
    const zh = lang === 'zh-CN';
    return {
      label: zh ? '上下架建议' : 'Catalog actions',
      summary: zh
        ? `下架候选 ${count(o.delist)} · 上新缺口 ${count(o.propose)}`
        : `delist ${count(o.delist)} · new-listing gaps ${count(o.propose)}`,
    };
  },

  place_ad: (input, output, lang) => {
    const status = isObj(output) ? String((output as { campaignStatus?: unknown }).campaignStatus ?? '') : '';
    const zh = lang === 'zh-CN';
    const tail = status === 'active'
      ? (zh ? '（已投放，可随时暂停）' : ' (live — can pause anytime)')
      : status === 'draft'
        ? (zh ? '（草稿，待你启动）' : ' (draft — awaiting your launch)')
        : '';
    return {
      label: zh ? '投广' : 'Ad',
      summary: zh
        ? `为${styleLabel(input.styleId, lang)}创建广告 · ${slotLabel(input.slot, lang)} · 日预算 ${money(input.budgetCents)}${tail}`
        : `Created an ad for ${styleLabel(input.styleId, lang)} · ${slotLabel(input.slot, lang)} · ${money(input.budgetCents)}/day${tail}`,
    };
  },

  set_group_buy_coupon: (input, _o, lang) => {
    const zh = lang === 'zh-CN';
    return {
      label: zh ? '团购' : 'Deal',
      summary: zh
        ? `为${styleLabel(input.styleId, lang)}创建团购草稿 · 券后 ${money(input.priceCents)}（待你发布）`
        : `Drafted a group-buy for ${styleLabel(input.styleId, lang)} · ${money(input.priceCents)} after coupon (awaiting publish)`,
    };
  },

  list_style: (input, _o, lang) => ({
    label: lang === 'zh-CN' ? '上架' : 'List',
    summary: lang === 'zh-CN' ? `上架${styleLabel(input.styleId, lang)}` : `Listed ${styleLabel(input.styleId, lang)}`,
  }),

  delist_style: (input, _o, lang) => ({
    label: lang === 'zh-CN' ? '下架' : 'Delist',
    summary: lang === 'zh-CN' ? `下架${styleLabel(input.styleId, lang)}` : `Delisted ${styleLabel(input.styleId, lang)}`,
  }),

  propose_listing: (input, _o, lang) => ({
    label: lang === 'zh-CN' ? '上新建议' : 'New-style',
    summary: lang === 'zh-CN'
      ? `建议上新：${String(input.gapTag ?? '')}${input.reason ? `（${truncate(String(input.reason), 60)}）` : ''}`
      : `Proposed a new listing: ${String(input.gapTag ?? '')}`,
  }),

  send_customer_message: (input, _o, lang) => ({
    label: lang === 'zh-CN' ? '老板消息' : 'Message',
    summary: lang === 'zh-CN'
      ? `以老板身份联系 ${String(input.customerName ?? '')}：${truncate(String(input.body ?? ''), 60)}`
      : `Messaged ${String(input.customerName ?? '')} as the boss: ${truncate(String(input.body ?? ''), 60)}`,
  }),
};

// The pre-Python demo seed used camelCase tool names with the same input shape — alias, don't special-case.
SUMMARIZERS.placeAd = SUMMARIZERS.place_ad;
SUMMARIZERS.setGroupBuyCoupon = SUMMARIZERS.set_group_buy_coupon;

export function describeToolCall(tool: string, input: unknown, output: unknown, lang: AppLang): StepDescription {
  const summarizer = SUMMARIZERS[tool];
  const detail = rawDetail(input, output);
  if (!summarizer) {
    // Unknown tool: name it, keep the sentence position honest, raw data stays in the expander.
    const io = compactJson(input, 60);
    return { label: tool, summary: io || (lang === 'zh-CN' ? '调用工具' : 'Tool call'), detail };
  }
  const { label, summary } = summarizer(isObj(input) ? input : {}, output, lang);
  return { label, summary, detail };
}

/** One transcript step → its merchant-facing description. */
export function describeStep(step: TranscriptStep, lang: AppLang): StepDescription {
  if (step.kind === 'reasoning') {
    return { label: lang === 'zh-CN' ? '推理' : 'Reasoning', summary: step.text, detail: null };
  }
  if (step.kind === 'tool_call') return describeToolCall(step.tool, step.input, step.output, lang);
  return { label: actionTypeLabel(step.actionType, lang), summary: step.summary, detail: null };
}

/** Multica-style tone per step kind: thinking=violet, tool=blue, action=emerald (CSS maps the colors). */
export function stepTone(kind: TranscriptStep['kind']): 'thinking' | 'tool' | 'action' {
  if (kind === 'reasoning') return 'thinking';
  if (kind === 'tool_call') return 'tool';
  return 'action';
}

// ── action descriptions (the 执行动作 list + inline AI cards) ───────────────────

const ACTION_LABELS: Record<AgentActionType, { 'zh-CN': string; en: string }> = {
  place_ad: { 'zh-CN': '投广', en: 'Ad' },
  set_group_buy_coupon: { 'zh-CN': '团购券', en: 'Coupon' },
  list_style: { 'zh-CN': '上架', en: 'List' },
  delist_style: { 'zh-CN': '下架', en: 'Delist' },
  draft_upload: { 'zh-CN': '上新草稿', en: 'Draft' },
  send_customer_message: { 'zh-CN': '老板消息', en: 'Message' },
};

export function actionTypeLabel(type: AgentActionType, lang: AppLang): string {
  return ACTION_LABELS[type]?.[lang] ?? type;
}

/** Human sentence for an action row — replaces JSON.stringify(payload). */
export function describeAction(type: AgentActionType, payload: Record<string, unknown>, lang: AppLang): string {
  const zh = lang === 'zh-CN';
  const p = payload ?? {};
  switch (type) {
    case 'place_ad':
      return zh
        ? `为${styleLabel(p.styleId, lang)}投放广告 · ${slotLabel(p.slot, lang)} · 日预算 ${money(p.budgetCents)}`
        : `Ad for ${styleLabel(p.styleId, lang)} · ${slotLabel(p.slot, lang)} · ${money(p.budgetCents)}/day`;
    case 'set_group_buy_coupon':
      return zh
        ? `为${styleLabel(p.styleId, lang)}设置团购券 · 券后 ${money(p.priceCents)}`
        : `Group-buy coupon for ${styleLabel(p.styleId, lang)} · ${money(p.priceCents)} after coupon`;
    case 'list_style':
      return zh ? `上架${styleLabel(p.styleId, lang)}` : `Listed ${styleLabel(p.styleId, lang)}`;
    case 'delist_style':
      return zh ? `下架${styleLabel(p.styleId, lang)}` : `Delisted ${styleLabel(p.styleId, lang)}`;
    case 'draft_upload': {
      const what = String(p.gapTag ?? p.styleTitle ?? p.styleId ?? '');
      return zh ? `生成上新草稿：${what}` : `Drafted a new listing: ${what}`;
    }
    case 'send_customer_message':
      return zh
        ? `以老板身份给 ${String(p.customerName ?? '')} 发送：${truncate(String(p.body ?? ''), 80)}`
        : `Messaged ${String(p.customerName ?? '')}: ${truncate(String(p.body ?? ''), 80)}`;
    default:
      return compactJson(p, 100);
  }
}

/** Deep link from an action to the real commercial object it produced (ADR-0012: proposals must be
 *  reviewable where they live). null when the action has no entity or no routable surface. */
export function actionEntityHref(action: Pick<AgentAction, 'entityType' | 'entityId'>): string | null {
  if (!action.entityType || !action.entityId) return null;
  if (action.entityType === 'style_ad') {
    // Campaign ids are `ad-<styleId>` (style-ad-actions.ts); the editor route is keyed by style.
    const styleId = action.entityId.startsWith('ad-') ? action.entityId.slice(3) : action.entityId;
    return `/merchant/styles/${styleId}/ads`;
  }
  return `${getMerchantManagePath()}?panel=groupbuy`;
}

/** Latest action per entity — the inline AI card shows current state, not one row per historical round.
 *  Actions with no entity fall back to (type + styleId/customer) so old seed rows still dedupe. */
export function dedupeActionsByEntity(actions: AgentAction[]): AgentAction[] {
  const seen = new Set<string>();
  const out: AgentAction[] = [];
  for (const a of actions) { // listActions returns newest-first; first hit per key wins
    const p = a.payload ?? {};
    const key = a.entityId
      ? `${a.entityType}:${a.entityId}`
      : `${a.type}:${String((p as { styleId?: unknown }).styleId ?? (p as { customerName?: unknown }).customerName ?? a.id)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}
