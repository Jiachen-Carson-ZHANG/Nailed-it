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
  it('summarizes the decision brain as candidate counts + utilization, never raw JSON', () => {
    const output = {
      capacity: { band: 'very_idle', utilizationPct: 33.4 },
      decisions: [
        { candidate: 'ad' }, { candidate: 'ad' }, { candidate: 'coupon' },
        { candidate: 'display_only' }, { candidate: 'skip' },
      ],
    };
    const d = describeToolCall('get_style_business_decisions', {}, output, 'zh-CN');
    expect(d.label).toBe('决策大脑');
    expect(d.summary).toBe('5 款分析：投广候选 2 · 团购候选 1 · 只展示 1 · 暂缓 1 · 下周产能 33%');
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
    expect(d.summary).toBe('为款式 8274创建广告 · 首页推荐位 · 日预算 SGD 200（草稿，待你启动）');
  });

  it('summarizes set_group_buy_coupon with the after-coupon price', () => {
    const d = describeToolCall(
      'set_group_buy_coupon',
      { styleId: 'style-melissa-img-8284', priceCents: 7040 },
      { dealId: 'gb-style-melissa-img-8284', dealStatus: 'draft' },
      'zh-CN',
    );
    expect(d.summary).toBe('为款式 8284创建团购草稿 · 券后 SGD 70.4（待你发布）');
  });

  it('handles the legacy camelCase seed tool names via aliases', () => {
    const d = describeToolCall('placeAd', { styleId: 'style-x-1234', slot: 'top_funnel', budgetCents: 5000 }, { adId: 'ad-seed-1' }, 'zh-CN');
    expect(d.label).toBe('投广');
    expect(d.summary).toContain('日预算 SGD 50');
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
    expect(describeStep(step, 'zh-CN').summary).toBe('8284 意向高但零转化 → 团购试价');
    expect(stepTone(step.kind)).toBe('thinking');
  });
  it('action steps use the action label + summary with the action tone', () => {
    const step = { kind: 'action', actionType: 'place_ad', status: 'applied', summary: '投广：8274' } as const;
    expect(describeStep(step, 'zh-CN')).toMatchObject({ label: '投广', summary: '投广：8274', detail: null });
    expect(stepTone(step.kind)).toBe('action');
  });
});

describe('describeAction', () => {
  it('renders a human sentence, not JSON.stringify(payload)', () => {
    const s = describeAction('set_group_buy_coupon', { styleId: 'style-melissa-img-8284', priceCents: 7040 }, 'zh-CN');
    expect(s).toBe('为款式 8284设置团购券 · 券后 SGD 70.4');
  });
  it('keeps short human style ids readable', () => {
    expect(styleLabel('minimal-solid', 'zh-CN')).toBe('款式 minimal-solid');
    expect(styleLabel('style-melissa-img-8249', 'en')).toBe('style 8249');
  });
});

describe('style titles (merchants see names, not machine ids)', () => {
  const titles = { 'style-melissa-img-8284': 'Melissa Design 8284' };

  it('styleLabel uses the real title when the map has it', () => {
    expect(styleLabel('style-melissa-img-8284', 'zh-CN', titles)).toBe('「Melissa Design 8284」');
    expect(styleLabel('style-melissa-img-9999', 'zh-CN', titles)).toBe('款式 9999'); // fallback survives
  });

  it('threads titles through tool-call and action sentences', () => {
    const d = describeToolCall('set_group_buy_coupon', { styleId: 'style-melissa-img-8284', priceCents: 7040 }, {}, 'zh-CN', titles);
    expect(d.summary).toContain('「Melissa Design 8284」');
    expect(describeAction('delist_style', { styleId: 'style-melissa-img-8284' }, 'zh-CN', titles))
      .toBe('下架「Melissa Design 8284」');
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
