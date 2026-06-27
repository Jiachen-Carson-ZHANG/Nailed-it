// Agent team definitions + demo historical runs (ADR-0007, Phase 1).
// Single source of truth: the memory repo seeds from AGENT_DEFINITIONS; scripts/seed-agents.ts
// writes the same definitions + generated runs into Supabase so the /merchant/agents panel and the
// Python service share them. Demo content is tied to the intelligence-seed anchors so the agent
// story matches the rest of the demo (金属感 8284 low-conversion, 暗黑 8281 gap, 8265 top converter).

import type { Agent, NewAgentRun } from '@/domain/agents';
import { demoMerchantId } from '@/mock/merchants';
import { LOW_CONVERSION_ID, GAP_STYLE_ID, TOP_CONVERTER_ID } from '@/mock/intelligence-seed';

export const AGENT_DEFINITIONS: Agent[] = [
  {
    id: 'agent-orchestrator',
    slug: 'orchestrator',
    name: '运营助手',
    role: 'lead',
    instructions:
      '你是美甲店的运营助手（主控）。每轮调度数分→决策→执行（投广/团购/上下架/用户运营）→监测，串联闭环。只在子代理给出的预计算数据上行动，不要臆造数字。',
    tools: [],
    version: 1,
  },
  {
    id: 'agent-insight',
    slug: 'insight',
    name: '数分 Agent',
    role: 'analyst',
    instructions:
      '你是数据分析代理（只读）。基于 getMerchantInsights / getDailySeries / 缺口与低转化检测 / 平台与外部热门，产出结构化简报与异常告警。只复述预计算数字，数据不足时说“数据不足”。',
    tools: ['get_merchant_insights'],
    version: 1,
  },
  {
    id: 'agent-decision',
    slug: 'decision',
    name: '决策 Agent',
    role: 'planner',
    instructions:
      '你是决策代理。把简报转成精确动作：投什么广、投多少钱、团购券设多少钱、上/下架哪些款。输出动作意图，由执行代理落地。',
    tools: ['get_merchant_insights'],
    version: 1,
  },
  {
    id: 'agent-ad',
    slug: 'ad',
    name: '投广 Agent',
    role: 'operator',
    instructions:
      '你是投广执行代理。对决策选定的款式在三段漏斗广告位投放（reasoning→投广 tool）。可逆，支持一键撤销。',
    tools: ['place_ad'],
    version: 1,
  },
  {
    id: 'agent-coupon',
    slug: 'coupon',
    name: '团购 Agent',
    role: 'operator',
    instructions:
      '你是团购执行代理。在价格 config 页面为款式设置团购券与券后价（reasoning→团购 tool）。可逆，支持一键撤销。',
    tools: ['set_group_buy_coupon'],
    version: 1,
  },
  {
    id: 'agent-catalog',
    slug: 'catalog',
    name: '运营 Agent（上下架）',
    role: 'operator',
    instructions:
      '你是款式运营代理。检测到品类缺口时提醒商家上架或基于现有拆解流程生成草稿；下架长期无效款式。可逆。',
    tools: ['list_style', 'delist_style', 'draft_upload'],
    version: 1,
  },
  {
    id: 'agent-customer-ops',
    slug: 'customer_ops',
    name: '用户运营 Agent',
    role: 'operator',
    instructions:
      '你是用户运营代理。基于 getCustomerIntelligence 起草获客/复购消息，在老板消息页面以“老板”身份发送，并附 AI 说明与推荐款式小卡片。可逆。',
    tools: ['send_customer_message'],
    version: 1,
  },
  {
    id: 'agent-monitor',
    slug: 'monitor',
    name: 'Monitor Agent',
    role: 'reviewer',
    instructions:
      '你是监测代理（只读）。对比动作前后的 analytics_events 衡量提升，无论好坏都反馈，并重新触发数分，闭合 B→C 回路。结论必须可追溯到事件。',
    tools: ['get_merchant_insights'],
    version: 1,
  },
];

/**
 * A few completed historical runs so the panel is not empty cold. Deterministic from `now`.
 * Demonstrates the full team loop: 数分 → 决策 → 投广 + 团购 → 运营(上下架, gated 提醒上架) + 用户运营 → Monitor.
 */
export function generateAgentRuns(now: number): NewAgentRun[] {
  const DAY = 86_400_000;
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

  const insightRunId = 'run-seed-insight';
  const decisionRunId = 'run-seed-decision';
  const adRunId = 'run-seed-ad';
  const couponRunId = 'run-seed-coupon';
  const catalogRunId = 'run-seed-catalog';
  const customerOpsRunId = 'run-seed-customer-ops';
  const monitorRunId = 'run-seed-monitor';

  return [
    {
      id: insightRunId,
      agentSlug: 'insight',
      merchantId: demoMerchantId,
      triggerSource: 'manual',
      parentRunId: null,
      status: 'completed',
      input: { rangeDays: 7 },
      output: {
        headline: '金属感需求上升，但转化偏弱；暗黑存在缺口。',
        alerts: ['金属感款 8284 高意向低转化（本周试戴多、预约少）'],
      },
      transcript: [
        { kind: 'reasoning', text: '读取本周 getMerchantInsights：金属感搜索上升，8284 试戴多但预约少；暗黑搜索 21 次仅 1 款在售。' },
        { kind: 'tool_call', tool: 'getMerchantInsights', input: { rangeDays: 7 }, output: { trendingUp: ['金属感'], lowConversion: [LOW_CONVERSION_ID], gap: '暗黑' } },
        { kind: 'reasoning', text: '产出简报：建议对低转化的金属感款做团购券提价/降价测试，对暗黑缺口提醒上架。' },
      ],
      startedAt: iso(2 * DAY),
      finishedAt: iso(2 * DAY - 4000),
    },
    {
      id: decisionRunId,
      agentSlug: 'decision',
      merchantId: demoMerchantId,
      triggerSource: 'event',
      parentRunId: insightRunId,
      status: 'completed',
      input: { briefingRunId: insightRunId },
      output: {
        actions: [
          { type: 'place_ad', styleId: TOP_CONVERTER_ID, slot: 'top_funnel', budgetCents: 5000 },
          { type: 'set_group_buy_coupon', styleId: LOW_CONVERSION_ID, priceCents: 6800 },
        ],
      },
      transcript: [
        { kind: 'reasoning', text: '8265 转化最高 → 投顶部漏斗广告放大曝光；8284 高意向低转化 → 团购券降到 SGD 68 试探价格敏感度。' },
      ],
      startedAt: iso(2 * DAY - 5000),
      finishedAt: iso(2 * DAY - 9000),
    },
    {
      id: adRunId,
      agentSlug: 'ad',
      merchantId: demoMerchantId,
      triggerSource: 'event',
      parentRunId: decisionRunId,
      status: 'completed',
      input: { styleId: TOP_CONVERTER_ID, slot: 'top_funnel', budgetCents: 5000 },
      output: { placed: true },
      transcript: [
        { kind: 'reasoning', text: '8265 历史转化高，顶部漏斗 ROI 预期最佳。' },
        { kind: 'tool_call', tool: 'placeAd', input: { styleId: TOP_CONVERTER_ID, slot: 'top_funnel', budgetCents: 5000 }, output: { adId: 'ad-seed-1' } },
        { kind: 'action', actionType: 'place_ad', status: 'applied', summary: '顶部漏斗广告：碎钻冰花法式（SGD 50 预算）' },
      ],
      startedAt: iso(2 * DAY - 10_000),
      finishedAt: iso(2 * DAY - 13_000),
      actions: [
        {
          runId: adRunId,
          merchantId: demoMerchantId,
          type: 'place_ad',
          risk: 'reversible',
          status: 'applied',
          payload: { styleId: TOP_CONVERTER_ID, slot: 'top_funnel', budgetCents: 5000 },
          createdAt: iso(2 * DAY - 12_000),
        },
      ],
    },
    {
      id: couponRunId,
      agentSlug: 'coupon',
      merchantId: demoMerchantId,
      triggerSource: 'event',
      parentRunId: decisionRunId,
      status: 'completed',
      input: { styleId: LOW_CONVERSION_ID, priceCents: 6800 },
      output: { couponSet: true },
      transcript: [
        { kind: 'reasoning', text: '8284 试戴多预约少，疑似价格偏高 → 设 SGD 68 尝鲜团购券验证。' },
        { kind: 'tool_call', tool: 'setGroupBuyCoupon', input: { styleId: LOW_CONVERSION_ID, priceCents: 6800 }, output: { couponId: 'coupon-seed-1' } },
        { kind: 'action', actionType: 'set_group_buy_coupon', status: 'applied', summary: '团购券：金属感款 → 券后 SGD 68' },
      ],
      startedAt: iso(2 * DAY - 14_000),
      finishedAt: iso(2 * DAY - 17_000),
      actions: [
        {
          runId: couponRunId,
          merchantId: demoMerchantId,
          type: 'set_group_buy_coupon',
          risk: 'reversible',
          status: 'applied',
          payload: { styleId: LOW_CONVERSION_ID, priceCents: 6800 },
          createdAt: iso(2 * DAY - 16_000),
        },
      ],
    },
    {
      id: catalogRunId,
      agentSlug: 'catalog',
      merchantId: demoMerchantId,
      triggerSource: 'event',
      parentRunId: insightRunId,
      status: 'awaiting_approval',
      input: { briefingRunId: insightRunId },
      output: { note: '暗黑缺口库内无匹配款式 → 提醒商家上架（待批准）。' },
      transcript: [
        { kind: 'reasoning', text: '暗黑搜索 21 次但在售仅 1 款，且库内无可直接上架的匹配款式 → 无法自行生成设计图。' },
        { kind: 'tool_call', tool: 'propose_listing', input: { gapTag: '暗黑', reason: '高搜索低供给，外部热门但库内无匹配' }, output: { proposed: true } },
        { kind: 'action', actionType: 'draft_upload', status: 'proposed', summary: '提醒上架（待商家批准）：暗黑 缺口 — 高搜索低供给，库内无匹配' },
      ],
      startedAt: iso(2 * DAY - 18_000),
      finishedAt: iso(2 * DAY - 20_000),
      actions: [
        {
          runId: catalogRunId,
          merchantId: demoMerchantId,
          type: 'draft_upload',
          risk: 'irreversible',
          status: 'proposed',
          payload: { gapTag: '暗黑', reason: '高搜索低供给，外部热门但库内无匹配' },
          createdAt: iso(2 * DAY - 19_000),
        },
      ],
    },
    {
      id: customerOpsRunId,
      agentSlug: 'customer_ops',
      merchantId: demoMerchantId,
      triggerSource: 'event',
      parentRunId: insightRunId,
      status: 'completed',
      input: { source: 'roster' },
      output: { note: '向最久未回访的老客发回归消息（以老板身份），附推荐款式。' },
      transcript: [
        { kind: 'reasoning', text: '名册中 Melissa Tan 上次做 8265 裸色法式，间隔较久 → 以老板口吻邀约回归，附 8265 推荐卡片。' },
        { kind: 'tool_call', tool: 'send_customer_message', input: { customerName: 'Melissa Tan', styleId: TOP_CONVERTER_ID }, output: { sent: true } },
        { kind: 'action', actionType: 'send_customer_message', status: 'applied', summary: '发送消息（以老板身份）：→ Melissa Tan' },
      ],
      startedAt: iso(2 * DAY - 21_000),
      finishedAt: iso(2 * DAY - 23_000),
      actions: [
        {
          runId: customerOpsRunId,
          merchantId: demoMerchantId,
          type: 'send_customer_message',
          risk: 'reversible',
          status: 'applied',
          payload: { customerName: 'Melissa Tan', body: '好久没见啦～你上次的裸色法式很衬你，这周新到一批同系列，要不要再约一次？', styleId: TOP_CONVERTER_ID },
          createdAt: iso(2 * DAY - 22_000),
        },
      ],
    },
    {
      id: monitorRunId,
      agentSlug: 'monitor',
      merchantId: demoMerchantId,
      triggerSource: 'event',
      parentRunId: adRunId,
      status: 'completed',
      input: { window: '7d', styleIds: [TOP_CONVERTER_ID, LOW_CONVERSION_ID] },
      output: {
        verdict: '投广后 8265 曝光→预约提升；团购券后 8284 预约回升。回路有效。',
        liftPct: { [TOP_CONVERTER_ID]: 22, [LOW_CONVERSION_ID]: 15 },
      },
      transcript: [
        { kind: 'reasoning', text: '对比动作前后 7 天 getMerchantInsights：8265 预约 +22%，8284 预约 +15%。重新触发数分。' },
        { kind: 'tool_call', tool: 'getMerchantInsights', input: { rangeDays: 7 }, output: { lift: { [TOP_CONVERTER_ID]: 22, [LOW_CONVERSION_ID]: 15 } } },
      ],
      startedAt: iso(1 * DAY),
      finishedAt: iso(1 * DAY - 5000),
    },
  ];
}
