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

/** styleId → what the merchant calls it. Styles have real titles ("Melissa Design 8284") — pass a
 *  `titles` map (from getStyleTitleMapAction) and the label IS the title. The id-derived form is only
 *  the fallback for rows whose style no longer exists. */
export type StyleTitleMap = Readonly<Record<string, string>>;

export function styleLabel(id: unknown, lang: AppLang, titles?: StyleTitleMap): string {
  const s = String(id ?? '').trim();
  if (!s) return '—';
  const title = titles?.[s];
  if (title) return lang === 'zh-CN' ? `「${title}」` : `"${title}"`;
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

// ADR-0016 sandbox audiences (audience implies funnel stage)
const AUDIENCES: Record<string, { 'zh-CN': string; en: string }> = {
  broad_local_interest: { 'zh-CN': '本地泛兴趣用户', en: 'broad local interest' },
  saved_or_viewed: { 'zh-CN': '收藏/浏览过的用户', en: 'saved or viewed' },
  try_on_no_booking: { 'zh-CN': '试戴未预约用户', en: 'tried on, no booking' },
};

const audienceLabel = (audience: string, lang: AppLang): string =>
  AUDIENCES[audience]?.[lang] ?? audience;

type Summarizer = (input: Record<string, unknown>, output: unknown, lang: AppLang, titles?: StyleTitleMap) => { label: string; summary: string };

/** The 决策大脑 payload: count candidates + quote utilization so the sentence carries the verdict. */
function summarizeDecisions(_input: Record<string, unknown>, output: unknown, lang: AppLang) {
  const o = isObj(output) ? output : {};
  const decisions = Array.isArray(o.decisions) ? (o.decisions as Array<{ signals?: string[] }>) : [];
  const withSignal = (s: string) => decisions.filter((d) => (d.signals ?? []).includes(s)).length;
  const util = isObj(o.capacity) ? Math.round(Number(o.capacity.utilizationPct) || 0) : null;
  const zh = lang === 'zh-CN';
  const label = zh ? '经营事实' : 'Business facts';
  if (decisions.length === 0) return { label, summary: zh ? '读取每款经营事实' : 'Read per-style business facts' };
  // ADR-0016: the engine emits facts+signals, not verdicts — summarize the load-bearing signals.
  const parts = zh
    ? `${decisions.length} 款事实：曝光不足 ${withSignal('underexposed')} · 高需求低转化 ${withSignal('low_conversion')} · ROAS 达标 ${withSignal('roas_above_target')}`
    : `${decisions.length} styles: underexposed ${withSignal('underexposed')} · low-conversion ${withSignal('low_conversion')} · ROAS-clear ${withSignal('roas_above_target')}`;
  const cap = util === null ? '' : zh ? ` · 下周产能 ${util}%` : ` · next-week utilization ${util}%`;
  return { label, summary: parts + cap };
}

const SUMMARIZERS: Record<string, Summarizer> = {
  get_style_business_decisions: summarizeDecisions, // legacy rows
  get_style_business_facts: summarizeDecisions,

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

  place_ad: (input, output, lang, titles) => {
    const status = isObj(output) ? String((output as { campaignStatus?: unknown }).campaignStatus ?? '') : '';
    const zh = lang === 'zh-CN';
    const tail = status === 'active'
      ? (zh ? '（已投放，可随时暂停）' : ' (live — can pause anytime)')
      : status === 'draft'
        ? (zh ? '（草稿，待你启动）' : ' (draft — awaiting your launch)')
        : '';
    // ADR-0016 contract: audience + total budget; legacy slot-based rows keep rendering.
    const target = input.audience ? audienceLabel(String(input.audience), lang) : slotLabel(input.slot, lang);
    const budget = input.totalBudgetCents
      ? (zh ? `总预算 ${money(input.totalBudgetCents)}（${String(input.durationDays ?? 4)} 天）` : `${money(input.totalBudgetCents)} total / ${String(input.durationDays ?? 4)}d`)
      : (zh ? `日预算 ${money(input.budgetCents)}` : `${money(input.budgetCents)}/day`);
    return {
      label: zh ? '投广' : 'Ad',
      summary: zh
        ? `为${styleLabel(input.styleId, lang, titles)}创建广告 · ${target} · ${budget}${tail}`
        : `Created an ad for ${styleLabel(input.styleId, lang, titles)} · ${target} · ${budget}${tail}`,
    };
  },

  forecast_ad_plan: (input, output, lang) => {
    const o = isObj(output) ? output : {};
    const b = Array.isArray(o.expected_bookings) ? (o.expected_bookings as number[]) : null;
    const zh = lang === 'zh-CN';
    return {
      label: zh ? '投前预测' : 'Forecast',
      summary: zh
        ? `预测方案：${audienceLabel(String(input.audience ?? ''), lang)} · ${money(input.totalBudgetCents)}${b ? ` → 预计 ${b[0]}–${b[1]} 单` : ''}`
        : `Forecast: ${audienceLabel(String(input.audience ?? ''), lang)} · ${money(input.totalBudgetCents)}${b ? ` → ${b[0]}–${b[1]} bookings` : ''}`,
    };
  },

  get_ad_account_state: (_i, output, lang) => {
    const o = isObj(output) ? output : {};
    const zh = lang === 'zh-CN';
    const rem = typeof o.remaining_budget_cents === 'number' ? money(o.remaining_budget_cents) : '';
    return { label: zh ? '广告账户' : 'Ad account', summary: zh ? `读取账户状态${rem ? `：剩余预算 ${rem}` : ''}` : `Account state${rem ? `: ${rem} remaining` : ''}` };
  },

  list_available_audiences: (_i, output, lang) => ({
    label: lang === 'zh-CN' ? '受众列表' : 'Audiences',
    summary: lang === 'zh-CN' ? `查看 ${count(output) || '可选'} 个可投受众` : `Listed ${count(output) || 'available'} audiences`,
  }),

  update_ad_campaign: (input, output, lang) => {
    const v = isObj(output) ? Number((output as { version?: unknown }).version) || null : null;
    const zh = lang === 'zh-CN';
    return {
      label: zh ? '修改广告' : 'Update ad',
      summary: zh
        ? `原地修改广告 ${String(input.campaignId ?? '')}${v ? `（第 ${v} 版）` : ''} —— 同一活动，不另起炉灶`
        : `Updated campaign ${String(input.campaignId ?? '')} in place${v ? ` (v${v})` : ''}`,
    };
  },

  pause_ad_campaign: (input, _o, lang) => ({
    label: lang === 'zh-CN' ? '暂停广告' : 'Pause ad',
    summary: lang === 'zh-CN' ? `止损暂停广告 ${String(input.campaignId ?? '')}（可恢复）` : `Paused campaign ${String(input.campaignId ?? '')} (resumable)`,
  }),

  submit_action_brief: (input, _o, lang) => {
    const zh = lang === 'zh-CN';
    const kind = input.action_type === 'ad' ? (zh ? '投广' : 'ad') : (zh ? '团购' : 'coupon');
    return {
      label: zh ? '行动简报' : 'Brief',
      summary: zh
        ? `提交${kind}简报：${String(input.style_id ?? '')} · 预算上限 ${money(input.max_total_budget_cents)} · ${truncate(String(input.objective ?? ''), 50)}`
        : `Filed ${kind} brief: ${String(input.style_id ?? '')} · budget ≤ ${money(input.max_total_budget_cents)}`,
    };
  },

  set_group_buy_coupon: (input, _o, lang, titles) => {
    const zh = lang === 'zh-CN';
    return {
      label: zh ? '团购' : 'Deal',
      summary: zh
        ? `为${styleLabel(input.styleId, lang, titles)}创建团购草稿 · 券后 ${money(input.priceCents)}（待你发布）`
        : `Drafted a group-buy for ${styleLabel(input.styleId, lang, titles)} · ${money(input.priceCents)} after coupon (awaiting publish)`,
    };
  },

  list_style: (input, _o, lang, titles) => ({
    label: lang === 'zh-CN' ? '上架' : 'List',
    summary: lang === 'zh-CN' ? `上架${styleLabel(input.styleId, lang, titles)}` : `Listed ${styleLabel(input.styleId, lang, titles)}`,
  }),

  delist_style: (input, _o, lang, titles) => ({
    label: lang === 'zh-CN' ? '下架' : 'Delist',
    summary: lang === 'zh-CN' ? `下架${styleLabel(input.styleId, lang, titles)}` : `Delisted ${styleLabel(input.styleId, lang, titles)}`,
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

  // ── Stage 3 (ADR-0016): message classes + merchandising verbs + coupon templates ──────────

  send_automated_notification: (input, _o, lang) => ({
    label: lang === 'zh-CN' ? '自动通知' : 'Notification',
    summary: lang === 'zh-CN'
      ? `以商家助手署名发送${String(input.kind ?? '')}通知 → ${String(input.customerName ?? '')}`
      : `Sent a labeled ${String(input.kind ?? '')} notification → ${String(input.customerName ?? '')}`,
  }),

  create_merchant_message_draft: (input, _o, lang) => ({
    label: lang === 'zh-CN' ? '消息草稿' : 'Message draft',
    summary: lang === 'zh-CN'
      ? `为 ${String(input.customerName ?? '')} 起草关系消息（待你亲自发送）：${truncate(String(input.reason ?? ''), 50)}`
      : `Drafted a relationship message for ${String(input.customerName ?? '')} (awaiting your send)`,
  }),

  get_coupon_constraints: (input, output, lang) => {
    const o = isObj(output) ? output : {};
    const n = count(o.templates);
    const zh = lang === 'zh-CN';
    return { label: zh ? '团购约束' : 'Coupon rules', summary: zh ? `读取 ${n || '可用'} 个预批模板与利润底线` : `Read ${n || 'approved'} templates + profit floor` };
  },

  feature_style: (input, _o, lang, titles) => ({
    label: lang === 'zh-CN' ? '推荐加权' : 'Feature',
    summary: lang === 'zh-CN'
      ? `提高${styleLabel(input.styleId, lang, titles)}的推荐位曝光`
      : `Featured ${styleLabel(input.styleId, lang, titles)}`,
  }),

  deprioritize_style: (input, _o, lang, titles) => ({
    label: lang === 'zh-CN' ? '降低曝光' : 'Deprioritize',
    summary: lang === 'zh-CN'
      ? `降低${styleLabel(input.styleId, lang, titles)}的推荐曝光（款式保留在库）`
      : `Deprioritized ${styleLabel(input.styleId, lang, titles)} (asset kept)`,
  }),

  // ── 监测回流 + 记忆 v2 (ADR-0013 P2/P3, ADR-0015) ──────────────────────────────────────────

  get_campaign_outcomes: (_i, output, lang) => {
    const n = count(output);
    const zh = lang === 'zh-CN';
    return { label: zh ? '活动实测' : 'Campaign data', summary: zh ? `读取 ${n || '全部'} 个广告活动的实测指标` : `Read live metrics for ${n || 'all'} campaigns` };
  },

  record_action_outcome: (input, _o, lang) => {
    const zh = lang === 'zh-CN';
    const conf = String(input.confidence ?? '');
    return {
      label: zh ? '写入记忆' : 'Memory',
      summary: zh
        ? `记录动作实测结论（置信度 ${conf}）：${truncate(String(input.assessment ?? ''), 80)}`
        : `Recorded a measured outcome (${conf}): ${truncate(String(input.assessment ?? ''), 80)}`,
    };
  },

  record_round_verdict: (input, _o, lang) => ({
    label: lang === 'zh-CN' ? '本轮结论' : 'Round verdict',
    summary: lang === 'zh-CN'
      ? `记录经营结论：${truncate(String(input.verdict ?? ''), 80)}`
      : `Recorded a round verdict: ${truncate(String(input.verdict ?? ''), 80)}`,
  }),

  search_memory: (_i, output, lang) => {
    const n = isObj(output) ? count((output as { memories?: unknown }).memories) : 0;
    const zh = lang === 'zh-CN';
    return { label: zh ? '查记忆' : 'Memory search', summary: zh ? `检索团队记忆，返回 ${n} 条相关结论` : `Searched team memory — ${n} relevant conclusions` };
  },

  read_blackboard: (input, _o, lang) => {
    const sections = Array.isArray(input.sections) && input.sections.length > 0 ? (input.sections as unknown[]).join(', ') : '';
    const zh = lang === 'zh-CN';
    return { label: zh ? '看白板' : 'Blackboard', summary: zh ? `查看本轮白板${sections ? `（${sections}）` : ''}` : `Read the round blackboard${sections ? ` (${sections})` : ''}` };
  },

  request_revision: (input, _o, lang) => {
    const zh = lang === 'zh-CN';
    return {
      label: zh ? '要求修订' : 'Revision',
      summary: zh
        ? `实测打脸该动作 → 驳回并让执行者重做：${truncate(String(input.feedback ?? ''), 70)}`
        : `Numbers contradict the action → sent it back: ${truncate(String(input.feedback ?? ''), 70)}`,
    };
  },

  dispatch_agent: (input, _o, lang) => ({
    label: lang === 'zh-CN' ? '分派' : 'Dispatch',
    summary: lang === 'zh-CN' ? `分派「${String(input.agent ?? '')}」执行任务` : `Dispatched "${String(input.agent ?? '')}"`,
  }),
};

// The pre-Python demo seed used camelCase tool names with the same input shape — alias, don't special-case.
SUMMARIZERS.placeAd = SUMMARIZERS.place_ad;
SUMMARIZERS.setGroupBuyCoupon = SUMMARIZERS.set_group_buy_coupon;

export function describeToolCall(tool: string, input: unknown, output: unknown, lang: AppLang, titles?: StyleTitleMap): StepDescription {
  const summarizer = SUMMARIZERS[tool];
  const detail = rawDetail(input, output);
  if (!summarizer) {
    // Unknown tool: name it, keep the sentence position honest, raw data stays in the expander.
    const io = compactJson(input, 60);
    return { label: tool, summary: io || (lang === 'zh-CN' ? '调用工具' : 'Tool call'), detail };
  }
  const { label, summary } = summarizer(isObj(input) ? input : {}, output, lang, titles);
  return { label, summary, detail };
}

/** One transcript step → its merchant-facing description. */
export function describeStep(step: TranscriptStep, lang: AppLang, titles?: StyleTitleMap): StepDescription {
  if (step.kind === 'reasoning') {
    return { label: lang === 'zh-CN' ? '推理' : 'Reasoning', summary: step.text, detail: null };
  }
  if (step.kind === 'tool_call') return describeToolCall(step.tool, step.input, step.output, lang, titles);
  return { label: actionTypeLabel(step.actionType, lang), summary: step.summary, detail: null };
}

/** Multica-style tone per step kind: thinking=violet, tool=blue, action=emerald (CSS maps the colors). */
export function stepTone(kind: TranscriptStep['kind']): 'thinking' | 'tool' | 'action' {
  if (kind === 'reasoning') return 'thinking';
  if (kind === 'tool_call') return 'tool';
  return 'action';
}

/** Which action type an execution tool records — the Python runner writes BOTH a tool_call and an
 *  action step for the same act, so a rendered chain says the same thing twice. */
const TOOL_ACTION_TYPE: Record<string, AgentActionType> = {
  place_ad: 'place_ad', placeAd: 'place_ad',
  update_ad_campaign: 'update_ad_campaign', pause_ad_campaign: 'pause_ad_campaign',
  feature_style: 'feature_style', deprioritize_style: 'deprioritize_style',
  send_automated_notification: 'send_customer_message',
  create_merchant_message_draft: 'draft_customer_message',
  set_group_buy_coupon: 'set_group_buy_coupon', setGroupBuyCoupon: 'set_group_buy_coupon',
  list_style: 'list_style', delist_style: 'delist_style',
  propose_listing: 'draft_upload', send_customer_message: 'send_customer_message',
};

/** Drop 'action' steps that restate the tool_call right before them. The action's status still shows on
 *  the run's 执行动作 list — the chain reads as a narrative, not a double-entry ledger. */
export function condenseTranscript(steps: TranscriptStep[]): TranscriptStep[] {
  return steps.filter((step, i) => {
    if (step.kind !== 'action') return true;
    const prev = steps[i - 1];
    return !(prev?.kind === 'tool_call' && TOOL_ACTION_TYPE[prev.tool] === step.actionType);
  });
}

// ── action descriptions (the 执行动作 list + inline AI cards) ───────────────────

const ACTION_LABELS: Record<AgentActionType, { 'zh-CN': string; en: string }> = {
  place_ad: { 'zh-CN': '投广', en: 'Ad' },
  update_ad_campaign: { 'zh-CN': '修改广告', en: 'Update ad' },
  pause_ad_campaign: { 'zh-CN': '暂停广告', en: 'Pause ad' },
  set_group_buy_coupon: { 'zh-CN': '团购券', en: 'Coupon' },
  list_style: { 'zh-CN': '上架', en: 'List' },
  delist_style: { 'zh-CN': '下架', en: 'Delist' },
  feature_style: { 'zh-CN': '推荐加权', en: 'Feature' },
  deprioritize_style: { 'zh-CN': '降低曝光', en: 'Deprioritize' },
  draft_upload: { 'zh-CN': '上新草稿', en: 'Draft' },
  send_customer_message: { 'zh-CN': '客户通知', en: 'Message' },
  draft_customer_message: { 'zh-CN': '消息草稿', en: 'Message draft' },
};

export function actionTypeLabel(type: AgentActionType, lang: AppLang): string {
  return ACTION_LABELS[type]?.[lang] ?? type;
}

/** Human sentence for an action row — replaces JSON.stringify(payload). */
export function describeAction(type: AgentActionType, payload: Record<string, unknown>, lang: AppLang, titles?: StyleTitleMap): string {
  const zh = lang === 'zh-CN';
  const p = payload ?? {};
  switch (type) {
    case 'place_ad':
      return zh
        ? `为${styleLabel(p.styleId, lang, titles)}投放广告 · ${slotLabel(p.slot, lang)} · 日预算 ${money(p.budgetCents)}`
        : `Ad for ${styleLabel(p.styleId, lang, titles)} · ${slotLabel(p.slot, lang)} · ${money(p.budgetCents)}/day`;
    case 'set_group_buy_coupon':
      return zh
        ? `为${styleLabel(p.styleId, lang, titles)}设置团购券 · 券后 ${money(p.priceCents)}`
        : `Group-buy coupon for ${styleLabel(p.styleId, lang, titles)} · ${money(p.priceCents)} after coupon`;
    case 'list_style':
      return zh ? `上架${styleLabel(p.styleId, lang, titles)}` : `Listed ${styleLabel(p.styleId, lang, titles)}`;
    case 'delist_style':
      return zh ? `下架${styleLabel(p.styleId, lang, titles)}` : `Delisted ${styleLabel(p.styleId, lang, titles)}`;
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
