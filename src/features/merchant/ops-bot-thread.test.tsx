import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { OpsBotThread } from './OpsBotThread';

// The 晨报 contract (2026-07-13 rebuild): the thread narrates yesterday's real numbers, the team's
// actions, measured outcomes, and the approval gate — it must NOT duplicate the insights dashboard
// (no weekly funnel / style bars / "recommended actions": agents act, they don't recommend).

vi.mock('@/lib/actions/insights-actions', () => ({
  getInsightsDailySeriesAction: vi.fn(async () => [
    ...Array.from({ length: 11 }, (_, i) => ({ date: `2026-06-${10 + i}`, tryOns: 2, bookings: 1, searches: 3 })),
    { date: '2026-07-11', tryOns: 3, bookings: 1, searches: 5 }, // day before yesterday
    { date: '2026-07-12', tryOns: 7, bookings: 4, searches: 5 }, // yesterday
    { date: '2026-07-13', tryOns: 1, bookings: 0, searches: 2 }, // today in progress (ignored)
  ]),
}));

vi.mock('@/lib/actions/merchant-home-actions', () => ({
  getMerchantTodayHomeAction: vi.fn(async () => ({
    stats: null,
    pending: [
      { id: 'a-1', runId: 'run-9', type: 'set_group_buy_coupon', status: 'proposed', agentLabel: '团购助手', icon: '🛍', title: '团购券 · 鎏金奢华', createdAt: '2026-07-12T10:00:00Z', controls: [] },
    ],
    recent: [
      { id: 'a-2', runId: 'run-7', type: 'update_ad_campaign', status: 'applied', agentLabel: '投广助手', icon: '📢', title: '修改广告 · 薄荷青法式', createdAt: '2026-07-12T09:00:00Z', controls: [] },
    ],
    technicians: [],
    agents: [],
    errors: [],
  })),
}));

vi.mock('@/lib/actions/agent-actions', () => ({
  listTeamMemoryAction: vi.fn(async () => [
    { id: 'm-1', kind: 'action_outcome', claim: '广告款式 8249 实测获客单价 1667 分，略低于预测 1800 分。', confidence: 'high', scopeId: null, comparison: { ratio: 0.93 }, createdAt: '2026-07-12T12:00:00Z', expiresAt: null },
    { id: 'm-2', kind: 'merchant_preference', claim: '团购底线：不低于成本价。', confidence: null, scopeId: null, comparison: null, createdAt: '2026-07-11T12:00:00Z', expiresAt: null },
  ]),
  listAgentRunsAction: vi.fn(async () => [
    { id: 'run-7', agentSlug: 'ad', agentName: '投广 Agent', agentRole: 'operator', merchantId: 'm', triggerSource: 'event', parentRunId: null, status: 'completed', input: {}, output: {}, transcript: [], startedAt: '2026-07-12T09:00:00Z', actions: [{}, {}] },
    { id: 'run-8', agentSlug: 'monitor', agentName: 'Monitor Agent', agentRole: 'reviewer', merchantId: 'm', triggerSource: 'event', parentRunId: null, status: 'completed', input: {}, output: {}, transcript: [], startedAt: '2026-07-12T08:45:00Z', actions: [] },
    { id: 'run-1', agentSlug: 'ad', agentName: '投广 Agent', agentRole: 'operator', merchantId: 'm', triggerSource: 'event', parentRunId: null, status: 'completed', input: {}, output: {}, transcript: [], startedAt: '2026-07-10T09:00:00Z', actions: [] },
  ]),
}));

function renderThread() {
  return render(
    <LanguageProvider role="merchant">
      <OpsBotThread />
    </LanguageProvider>
  );
}

describe('OpsBotThread team debrief', () => {
  it('narrates yesterday with deltas vs the day before (last point = today, ignored)', async () => {
    const { container } = renderThread();
    expect(await screen.findByText('昨日经营')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument(); // yesterday try-ons
    expect(screen.getByText('较前日 +4')).toBeInTheDocument(); // 7 vs 3
    expect(screen.getByText('较前日 +3')).toBeInTheDocument(); // bookings 4 vs 1
    expect(screen.getByText('与前日持平')).toBeInTheDocument(); // searches 5 vs 5
    expect(container.querySelectorAll('svg.sparkline').length).toBe(2);
  });

  it('shows the latest round (tight run cluster, not the whole calendar day) + a reasoning deep-link', async () => {
    renderThread();
    // run-7 (09:00) + run-8 (08:45) cluster within 30min; run-1 (two days earlier) must NOT count.
    expect(await screen.findByText('最近一轮：2 次运行 · 2 个动作 · 全部成功')).toBeInTheDocument();
    expect(screen.getByText('修改广告 · 薄荷青法式')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看推理 →' })).toHaveAttribute('href', '/merchant/agents/runs/run-7');
  });

  it('surfaces measured outcomes (not preferences) with the deviation badge', async () => {
    renderThread();
    expect(await screen.findByText(/实测获客单价 1667/)).toBeInTheDocument();
    expect(screen.getByText('预测偏差 ×0.93')).toBeInTheDocument();
    expect(screen.queryByText(/团购底线/)).not.toBeInTheDocument();
  });

  it('pins the approval gate and links to the 今日 home', async () => {
    renderThread();
    expect(await screen.findByText('1 件事在等你拍板')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去处理 →' })).toHaveAttribute('href', '/merchant/calendar');
  });

  it('falls back to the last ACTIVE day with a date tag when yesterday is empty (stale seed)', async () => {
    const { getInsightsDailySeriesAction } = await import('@/lib/actions/insights-actions');
    vi.mocked(getInsightsDailySeriesAction).mockResolvedValueOnce([
      { date: '2026-07-09', tryOns: 4, bookings: 2, searches: 6 }, // last active day
      { date: '2026-07-10', tryOns: 5, bookings: 3, searches: 1 },
      { date: '2026-07-11', tryOns: 0, bookings: 0, searches: 0 },
      { date: '2026-07-12', tryOns: 0, bookings: 0, searches: 0 }, // empty yesterday
      { date: '2026-07-13', tryOns: 0, bookings: 0, searches: 0 }, // today
    ]);
    renderThread();
    expect(await screen.findByText('昨日经营（最近有数据：07月10日）')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // 07-10 try-ons, not a zero wall
  });

  it('does NOT duplicate the insights dashboard (no funnel / style bars / recommendations)', async () => {
    renderThread();
    await screen.findByText('昨日经营');
    expect(screen.queryByText('本周报告')).not.toBeInTheDocument();
    expect(screen.queryByText('款式表现')).not.toBeInTheDocument();
    expect(screen.queryByText('建议行动')).not.toBeInTheDocument();
    expect(screen.queryByText('客户旅程')).not.toBeInTheDocument();
  });
});
