import { describe, expect, it } from 'vitest';
import type { AgentAction } from './agents';
import {
  actionEntityHref,
  condenseTranscript,
  dedupeActionsByEntity,
  describeAction,
  describeStep,
  describeToolCall,
  stepTone,
  styleLabel,
} from './agent-transcript';

// The merchant-facing transcript contract (UI-alignment pass): every step renders as ONE human sentence;
// raw JSON may only appear in the `detail` expander. These tests pin the sentences for the real tool
// payload shapes the Python service writes (tools.py transcript.append calls).

describe('describeToolCall', () => {
  it('summarizes the business engine as signal counts + utilization, never raw JSON (ADR-0016)', () => {
    const output = {
      capacity: { band: 'very_idle', utilizationPct: 33.4 },
      decisions: [
        { signals: ['underexposed', 'roas_above_target'] },
        { signals: ['underexposed'] },
        { signals: ['low_conversion', 'high_demand'] },
        { signals: ['low_demand'] },
      ],
    };
    const d = describeToolCall('get_style_business_decisions', {}, output, 'zh-CN');
    expect(d.label).toBe('经营事实');
    expect(d.summary).toBe('4 款事实：曝光不足 2 · 高需求低转化 1 · ROAS 达标 1 · 下周产能 33%');
    expect(d.summary).not.toContain('{'); // the JSON stays in detail
    expect(d.detail).toContain('"utilizationPct"');
  });

  it('summarizes place_ad with slot, budget and the draft/live outcome', () => {
    const d = describeToolCall(
      'place_ad',
      { styleId: 'style-melissa-img-8274', slot: 'top_funnel', budgetCents: 20000 },
      { entityId: 'ad-style-melissa-img-8274', campaignStatus: 'draft' },
      'zh-CN',
    );
    expect(d.summary).toBe('为「碎冰玫瑰猫眼」创建广告 · 首页推荐位 · 日预算 ¥200（草稿，待你启动）');
  });

  it('summarizes set_group_buy_coupon with the after-coupon price', () => {
    const d = describeToolCall(
      'set_group_buy_coupon',
      { styleId: 'style-melissa-img-8284', priceCents: 7040 },
      { dealId: 'gb-style-melissa-img-8284', dealStatus: 'draft' },
      'zh-CN',
    );
    expect(d.summary).toBe('为「鎏金奢华」创建团购草稿 · 券后 ¥70.4（待你发布）');
  });

  it('handles the legacy camelCase seed tool names via aliases', () => {
    const d = describeToolCall('placeAd', { styleId: 'style-x-1234', slot: 'top_funnel', budgetCents: 5000 }, { adId: 'ad-seed-1' }, 'zh-CN');
    expect(d.label).toBe('投广');
    expect(d.summary).toContain('日预算 ¥50');
  });

  it('falls back honestly for unknown tools: name as label, raw only in detail', () => {
    const d = describeToolCall('mystery_tool', { a: 1 }, { b: 2 }, 'zh-CN');
    expect(d.label).toBe('mystery_tool');
    expect(d.detail).toContain('"a": 1');
  });

  it('caps enormous payloads in detail instead of rendering them whole', () => {
    const big = { rows: Array.from({ length: 500 }, (_, i) => ({ i, text: 'x'.repeat(40) })) };
    const d = describeToolCall('mystery_tool', {}, big, 'en');
    expect(d.detail!.length).toBeLessThan(4200);
    expect(d.detail).toContain('truncated');
  });
});

describe('describeStep / stepTone', () => {
  it('reasoning renders its text with the thinking tone', () => {
    const step = { kind: 'reasoning', text: '8284 意向高但零转化 → 团购试价' } as const;
    expect(describeStep(step, 'zh-CN').summary).toBe('「鎏金奢华」意向高但零转化 → 团购试价');
    expect(stepTone(step.kind)).toBe('thinking');
  });
  it('sanitizes strong-tier reasoning: strips markdown, drops internal UUIDs, resolves style ids', () => {
    const step = {
      kind: 'reasoning',
      text: '本轮监测已完成。 ### 记忆写入 * **动作 `0c9fb3b3-f3f8`(广告-8284)**: 写入高置信度结论。 广告活动 `ad-style-melissa-img-8249` 表现中等。',
    } as const;
    const s = describeStep(step, 'zh-CN').summary;
    expect(s).not.toMatch(/[#*`]/);       // no leaked markdown syntax
    expect(s).not.toContain('0c9fb3b3');  // internal UUID dropped
    expect(s).toContain('「薄荷青法式」'); // style id resolved to a readable name
    expect(s).toContain('· 动作');         // bullet normalized
    expect(s).toContain('(广告-「鎏金奢华」)'); // the human label kept
  });
  it('action steps use the action label + summary with the action tone', () => {
    const step = { kind: 'action', actionType: 'place_ad', status: 'applied', summary: '投广：8274' } as const;
    expect(describeStep(step, 'zh-CN')).toMatchObject({ label: '投广', summary: '投广：「碎冰玫瑰猫眼」', detail: null });
    expect(stepTone(step.kind)).toBe('action');
  });
});

describe('describeAction', () => {
  it('renders a human sentence, not JSON.stringify(payload)', () => {
    const s = describeAction('set_group_buy_coupon', { styleId: 'style-melissa-img-8284', priceCents: 7040 }, 'zh-CN');
    expect(s).toBe('为「鎏金奢华」设置团购券 · 券后 ¥70.4');
  });
  it('keeps short human style ids readable', () => {
    expect(styleLabel('minimal-solid', 'zh-CN')).toBe('款式 minimal-solid');
    expect(styleLabel('style-melissa-img-8249', 'en')).toBe('"Mint French"');
  });
  it('narrates update_ad_campaign changes instead of dumping the payload JSON', () => {
    // The real tools.py payload shape — this used to hit the default compactJson branch and render
    // `{"changes":{"version":8,...` on the 执行动作 card.
    const s = describeAction('update_ad_campaign', {
      campaignId: 'ad-style-melissa-img-8249',
      styleId: 'style-melissa-img-8249',
      changes: { version: 8, audience: 'try_on_no_booking', duration_days: 5, daily_budget_cents: 1000 },
    }, 'zh-CN');
    expect(s).not.toContain('{');
    expect(s).toContain('第 8 版');
    expect(s).toContain('试戴未预约');
    expect(s).toContain('投放 5 天');
  });
  it('narrates pause/feature/deprioritize/draft-message actions as sentences', () => {
    expect(describeAction('pause_ad_campaign', { campaignId: 'ad-x', styleId: 'style-melissa-img-8249' }, 'zh-CN')).not.toContain('{');
    expect(describeAction('feature_style', { styleId: 'style-melissa-img-8249', reason: '转化最高' }, 'zh-CN')).toContain('推荐曝光');
    expect(describeAction('deprioritize_style', { styleId: 'style-melissa-img-8249', reason: '低需求' }, 'zh-CN')).toContain('保留在库');
    expect(describeAction('draft_customer_message', { customerName: 'Amy', body: '好久不见' }, 'zh-CN')).toContain('待你亲自发送');
  });
});

describe('style titles (merchants see names, not machine ids)', () => {
  const titles = { 'style-melissa-img-8284': 'Melissa Design 8284' };

  it('styleLabel prefers a meaningful title and hides generic Melissa Design titles', () => {
    expect(styleLabel('style-melissa-img-8284', 'zh-CN', titles)).toBe('「鎏金奢华」');
    expect(styleLabel('style-melissa-img-8284', 'zh-CN', { 'style-melissa-img-8284': '金色猫眼样片' })).toBe('「金色猫眼样片」');
    expect(styleLabel('style-melissa-img-9999', 'zh-CN', titles)).toBe('款式 9999'); // fallback survives
  });

  it('threads titles through tool-call and action sentences', () => {
    const d = describeToolCall('set_group_buy_coupon', { styleId: 'style-melissa-img-8284', priceCents: 7040 }, {}, 'zh-CN', titles);
    expect(d.summary).toContain('「鎏金奢华」');
    expect(describeAction('delist_style', { styleId: 'style-melissa-img-8284' }, 'zh-CN', titles))
      .toBe('下架「鎏金奢华」');
  });
});

describe('condenseTranscript', () => {
  it('drops the action step that restates the tool_call before it (no double-entry chains)', () => {
    const steps = [
      { kind: 'tool_call', tool: 'set_group_buy_coupon', input: { styleId: 's' }, output: { dealId: 'gb-s' } },
      { kind: 'action', actionType: 'set_group_buy_coupon', status: 'proposed', summary: '团购草稿：s' },
      { kind: 'reasoning', text: '结论' },
    ] as const;
    const out = condenseTranscript([...steps]);
    expect(out.map((s) => s.kind)).toEqual(['tool_call', 'reasoning']);
  });

  it('keeps action steps that stand alone or follow a different tool', () => {
    const steps = [
      { kind: 'tool_call', tool: 'get_merchant_insights', input: {}, output: {} },
      { kind: 'action', actionType: 'send_customer_message', status: 'applied', summary: '唤回' },
    ] as const;
    expect(condenseTranscript([...steps])).toHaveLength(2);
  });
});

describe('actionEntityHref', () => {
  it('routes a style_ad entity to the per-style ads editor', () => {
    expect(actionEntityHref({ entityType: 'style_ad', entityId: 'ad-style-melissa-img-8274' }))
      .toBe('/merchant/styles/style-melissa-img-8274/ads');
  });
  it('routes a groupbuy entity to the 团购管理 tab', () => {
    expect(actionEntityHref({ entityType: 'groupbuy_deal', entityId: 'gb-style-melissa-img-8284' }))
      .toBe('/merchant/manage?panel=groupbuy');
  });
  it('returns null for entity-less actions (a sent message has nowhere to go)', () => {
    expect(actionEntityHref({ entityType: null, entityId: null })).toBeNull();
  });
});

describe('dedupeActionsByEntity', () => {
  const mk = (id: string, over: Partial<AgentAction>): AgentAction => ({
    id, runId: 'r', merchantId: 'm', type: 'set_group_buy_coupon', risk: 'reversible', status: 'applied',
    payload: { styleId: 'style-melissa-img-8284' }, createdAt: '2026-07-10T00:00:00Z', ...over,
  });

  it('keeps only the newest action per entity — no more 4 duplicate rows for one deal', () => {
    const rows = [
      mk('a4', { entityType: 'groupbuy_deal', entityId: 'gb-1' }), // newest first (repo order)
      mk('a3', { entityType: 'groupbuy_deal', entityId: 'gb-1' }),
      mk('a2', { entityType: 'groupbuy_deal', entityId: 'gb-1' }),
      mk('a1', { entityType: 'style_ad', entityId: 'ad-1', type: 'place_ad' }),
    ];
    expect(dedupeActionsByEntity(rows).map((a) => a.id)).toEqual(['a4', 'a1']);
  });

  it('dedupes entity-less legacy rows by type + styleId', () => {
    const rows = [mk('b2', {}), mk('b1', {})];
    expect(dedupeActionsByEntity(rows).map((a) => a.id)).toEqual(['b2']);
  });
});

describe('memory v2 tool describers (ADR-0015)', () => {
  it('describes record_action_outcome with the assessment and confidence', () => {
    const d = describeToolCall(
      'record_action_outcome',
      { actionId: 'act-1', assessment: '实测每单花费 280 元，决策预测 80 元——低估约 3.5 倍', confidence: 'high' },
      { recorded: true },
      'zh-CN',
    );
    expect(d.label).toBe('写入记忆');
    expect(d.summary).toContain('280');
    expect(d.summary).toContain('high');
  });

  it('describes request_revision with the numeric feedback', () => {
    const d = describeToolCall('request_revision', { actionId: 'act-1', feedback: '日预算从 200 降到 80' }, {}, 'zh-CN');
    expect(d.label).toBe('要求修订');
    expect(d.summary).toContain('日预算从 200 降到 80');
  });

  it('describes search_memory with the hit count', () => {
    const d = describeToolCall('search_memory', { scopeRefs: ['style-1'] }, { memories: [{}, {}] }, 'zh-CN');
    expect(d.summary).toContain('2 条');
  });

  it('describes record_round_verdict and dispatch_agent', () => {
    expect(describeToolCall('record_round_verdict', { verdict: '满产能时不应继续获客' }, {}, 'zh-CN').summary).toContain('满产能');
    expect(describeToolCall('dispatch_agent', { agent: 'insight' }, { runId: 'r1' }, 'zh-CN').summary).toContain('insight');
  });
});
