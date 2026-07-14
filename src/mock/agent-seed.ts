// Agent team definitions + demo historical runs (ADR-0007, Phase 1).
// Single source of truth: the memory repo seeds from AGENT_DEFINITIONS; scripts/seed-agents.ts
// writes the same definitions + generated runs into Supabase so the /merchant/agents panel and the
// Python service share them. Demo content is tied to the intelligence-seed anchors so the agent
// story matches the rest of the demo (金属感 8284 low-conversion, 暗黑 supply gap, 8265 top converter).

import type { Agent, NewAgentRun } from '@/domain/agents';
import { demoMerchantId } from '@/mock/merchants';
import { LOW_CONVERSION_ID, TOP_CONVERTER_ID } from '@/mock/intelligence-seed';
// Runtime tool truth, shared with the Python runner (orchestrator.py loads the same file) so the
// agents table's tools column can never drift from what the tool loop actually enforces.
import AGENT_TOOLS from '@/mock/agent-tools.json';

export const AGENT_DEFINITIONS: Agent[] = [
  {
    id: 'agent-orchestrator',
    slug: 'orchestrator',
    name: '运营助手',
    role: 'lead',
    // Fallback only — the runtime prompt is agent-service/skills/orchestrator.md (ADR-0013 P1).
    instructions:
      '你是美甲店的运营助手（主控）。每轮先读简报与决策大脑，再决定唤醒哪些 Agent：数分与决策必跑，执行环节按信号分派或跳过（跳过要给数字理由），相互独立的环节并行。只在预计算数据上行动，不要臆造数字。',
    tools: AGENT_TOOLS.orchestrator,
    version: 3,
  },
  {
    id: 'agent-insight',
    slug: 'insight',
    name: '数分 Agent',
    role: 'analyst',
    instructions:
      '你是数据分析代理（只读），分析顾客旅程漏斗（曝光→点击→详情→试戴→预约）。基于 getMerchantInsights 产出 top/bottom 转化款、高意向低转化款、流失客户与异常告警。只复述预计算数字，数据不足时说“数据不足”。',
    tools: AGENT_TOOLS.insight,
    version: 2,
  },
  {
    id: 'agent-trend',
    slug: 'trend',
    name: '选品 Agent',
    role: 'analyst',
    instructions:
      '你是选品/趋势代理（只读）。结合外部趋势（Pinterest/固定）+ 内部上升需求 + 平台热门，匹配到本店款式并分类为放大/试价/缺口上架/下架候选，按机会分排序。基于 get_trend_opportunities / get_platform_hot / get_external_trends，只用预计算数据，去重后再计数，缺口必须确为库内无匹配。',
    tools: AGENT_TOOLS.trend,
    version: 2,
  },
  {
    id: 'agent-decision',
    slug: 'decision',
    name: '商分 Agent', // display name (slug stays `decision`; Python/prompts unchanged)
    role: 'planner',
    instructions:
      '你是经营组合决策者。读经营事实（信号+经济性，无判决）与记忆提示，为本轮制定行动组合，用 submit_action_brief 提交"目标+硬边界"的行动简报——执行参数（受众/精确预算/券配置）由执行代理在简报内自行寻找。可以不提交任何简报。',
    tools: AGENT_TOOLS.decision,
    version: 5,
  },
  {
    id: 'agent-ad',
    slug: 'ad',
    name: '投广 Agent',
    role: 'operator',
    instructions:
      '你是投广执行代理。收到行动简报（目标+硬边界）后，用 forecast_ad_plan 比较受众/预算/时长方案，落地最小可行配置；边界内不可行时如实上报，绝不硬投。修订时用 update_ad_campaign 修改同一活动。',
    tools: AGENT_TOOLS.ad,
    version: 2,
  },
  {
    id: 'agent-coupon',
    slug: 'coupon',
    name: '团购 Agent',
    role: 'operator',
    instructions:
      '你是团购执行代理。折扣只能来自商家预批模板（get_coupon_constraints），价格由代码计算；你的判断是限制条件——给谁、什么时段核销、发几张、多久过期。永远创建草稿，商家发布。不承诺预约数——效果由监测实测。',
    tools: AGENT_TOOLS.coupon,
    version: 2,
  },
  {
    id: 'agent-catalog',
    slug: 'catalog',
    name: '运营 Agent（上下架）',
    role: 'operator',
    instructions:
      '你是陈列运营代理。调整曝光分配，从不移除资产：get_catalog_actions 取候选后 deprioritize_style 降低长期低效款曝光（款式保留在库）、feature_style 加权、propose_listing 提上新建议（待批准）。真正停售是商家专属操作。',
    tools: AGENT_TOOLS.catalog,
    version: 3,
  },
  {
    id: 'agent-customer-ops',
    slug: 'customer_ops',
    name: '用户运营 Agent',
    role: 'operator',
    instructions:
      '你是用户运营代理。两类消息都由你直接自动发送并署名"商家助手"（绝不冒充老板/真人）：事务/产品通知走 send_automated_notification；关系型/个性化营销走 send_relationship_message，找对客户、写好正文、说明时机。opt-out 是硬红线：名册标记拒收的客户绝不发送。',
    tools: AGENT_TOOLS.customer_ops,
    version: 4,
  },
  {
    id: 'agent-monitor',
    slug: 'monitor',
    name: 'Monitor Agent',
    role: 'reviewer',
    instructions:
      '你是监测代理，团队记忆的唯一写入者。任务中会给出本轮执行清单（含 action id 与决策预测快照）。用 get_campaign_outcomes 实测，record_action_outcome 记录实测 vs 预测的差异，record_round_verdict 记录本轮经营结论（需动作证据）；对明确越线的动作可发起一次修订（request_revision）。结论必须可追溯到实测数字。',
    tools: AGENT_TOOLS.monitor,
    version: 4,
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
        { kind: 'reasoning', text: '读取本周 getMerchantInsights：金属感搜索上升，8284 试戴多但预约少；暗黑搜索 21 次、库内供给不足。' },
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
        { kind: 'reasoning', text: '8265 转化最高 → 投顶部漏斗广告放大曝光；8284 高意向低转化 → 团购券降到 ¥68 试探价格敏感度。' },
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
        { kind: 'action', actionType: 'place_ad', status: 'applied', summary: '顶部漏斗广告：碎钻冰花法式（¥50 预算）' },
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
        { kind: 'reasoning', text: '8284 试戴多预约少，疑似价格偏高 → 设 ¥68 尝鲜团购券验证。' },
        { kind: 'tool_call', tool: 'setGroupBuyCoupon', input: { styleId: LOW_CONVERSION_ID, priceCents: 6800 }, output: { couponId: 'coupon-seed-1' } },
        { kind: 'action', actionType: 'set_group_buy_coupon', status: 'applied', summary: '团购券：金属感款 → 券后 ¥68' },
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
          // Points at a real seeded deal (ADR-0012): undoing this action must unlist that deal, not just
          // flip the log row. Memory mode has to behave like Supabase or the demo lies about undo.
          entityType: 'groupbuy_deal',
          entityId: 'deal-001',
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
        { kind: 'reasoning', text: '调用 get_catalog_actions 获取候选：无可下架款；暗黑为库内无匹配的缺口 → 提醒上架。' },
        { kind: 'tool_call', tool: 'get_catalog_actions', input: { rangeDays: 7 }, output: { delist: [], propose: [{ tag: '暗黑', reason: '外部热门但库内无匹配' }] } },
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
      output: { note: '向最久未回访的老客发回归消息（以老板身份）。' },
      transcript: [
        { kind: 'reasoning', text: '名册中 Melissa Tan 上次做 8265 裸色法式，间隔较久 → 以老板口吻邀约回归。' },
        { kind: 'tool_call', tool: 'send_customer_message', input: { customerName: 'Melissa Tan' }, output: { sent: true } },
        { kind: 'action', actionType: 'send_customer_message', status: 'applied', summary: '发送消息（以老板身份）：→ Melissa Tan' },
      ],
      startedAt: iso(2 * DAY - 21_000),
      finishedAt: iso(2 * DAY - 23_000),
      actions: [
        {
          runId: customerOpsRunId,
          merchantId: demoMerchantId,
          type: 'send_customer_message',
          risk: 'irreversible', // a sent message can't be un-sent → view-only, no undo (matches tools.py)
          status: 'applied',
          payload: { customerName: 'Melissa Tan', body: '好久没见啦～你上次的裸色法式很衬你，这周新到一批同系列，要不要再约一次？' },
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
