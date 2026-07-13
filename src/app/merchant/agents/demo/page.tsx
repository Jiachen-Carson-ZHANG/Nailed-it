'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BusinessClock } from '@/features/merchant/BusinessClock';
import { advanceClockAndRunAction } from '@/lib/actions/agent-actions';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';

const copy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 演示控制台',
    title: '演示控制台',
    body: '仅用于现场演示，商家日常不会看到这里。',
    back: '← 返回运营团队',
    explainTitle: '推进时钟 ≠ AI 推理',
    explain: '推进业务时钟只是「模拟市场结算」——用确定性数学把 72/96 小时的曝光、点击、预约、花费累加到活动上，全过程没有任何 AI 推理。真正的判断发生在之后运行的一轮：代理团队读取这些结算结果，才做出诊断、修订与记忆。同一场景种子 → 同一结果，演示可复现。',
    seedLabel: '场景种子',
    seed: 'finals-a（隐藏市场：泛流量质量 0.55 · 转化摩擦 1.40 · 高意向 1.35）',
    twoModes: '两种推进方式',
    scriptedTitle: '① 脚本回放（默认，上台安全）',
    scriptedBody: '下方时钟按预先录制的真实 trace 逐拍展开，不调用模型——零延迟、零抖动，适合正式演示。',
    liveTitle: '② 结算 + 真实一轮（本地测试用）',
    liveBody: '先推进业务时钟做市场结算（产生数据），随后立即运行一轮真实代理——你能看到团队现场读取结算数字并推理。会调用模型、有延迟，也可能遇到真实的失败模式。',
    liveHours: '推进小时数',
    liveRun: '结算并运行真实一轮',
    liveRunning: '正在结算 + 启动一轮…',
    liveStarted: '已结算并启动一轮 — 到「运行审计」查看团队如何推理。',
    liveConfirm: '这会推进业务时钟并运行一轮真实代理（调用模型、产生少量费用）。确认？',
    viewRuns: '→ 运行审计',
  },
  en: {
    eyebrow: 'Nailed AI · Demo console',
    title: 'Demo console',
    body: 'Stage-only. Merchants never see this in normal use.',
    back: '← Back to agent team',
    explainTitle: 'Advancing the clock ≠ AI reasoning',
    explain: 'Advancing the clock is pure market SETTLEMENT — deterministic math that accumulates 72/96h of impressions, clicks, bookings and spend onto campaigns. No AI runs during this step. The reasoning happens on the round that runs AFTER: the team reads these settled numbers, then diagnoses, revises, and remembers. Same scenario seed → same result — reproducible.',
    seedLabel: 'Scenario seed',
    seed: 'finals-a (hidden market: broad quality 0.55 · booking friction 1.40 · high-intent 1.35)',
    twoModes: 'Two ways to advance',
    scriptedTitle: '① Scripted replay (default, stage-safe)',
    scriptedBody: 'The clock below unfolds a pre-recorded real trace beat by beat — no model calls, zero latency or flake. Best for the live pitch.',
    liveTitle: '② Settle + a real round (local testing)',
    liveBody: 'Advance the clock to settle the market (produce data), then immediately run a real agent round — watch the team read the settled numbers and reason live. Calls the model, has latency, can hit real failure modes.',
    liveHours: 'Advance hours',
    liveRun: 'Settle & run a real round',
    liveRunning: 'Settling + starting a round…',
    liveStarted: 'Settled and started a round — see Run Audit for how the team reasons.',
    liveConfirm: 'This advances the clock and runs a real agent round (calls the model, small cost). Proceed?',
    viewRuns: '→ Run audit',
  },
} satisfies Record<AppLanguage, Record<string, string>>;

export default function MerchantAgentDemoPage() {
  const { language } = useLanguage();
  const c = copy[language];
  const [hours, setHours] = useState(72);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);

  async function runLive() {
    if (running || !window.confirm(c.liveConfirm)) return;
    setRunning(true);
    setStarted(false);
    const res = await advanceClockAndRunAction(hours);
    setRunning(false);
    if (!res.ok) { window.alert(res.error ?? 'failed'); return; }
    setStarted(true);
  }

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="profile-hero">
        <Link href="/merchant/agents" className="agent-back-link">{c.back}</Link>
        <p className="section-eyebrow">{c.eyebrow}</p>
        <h1>{c.title}</h1>
        <p className="section-copy">{c.body}</p>
      </section>

      <section className="detail-surface agent-demo-explain">
        <h2>{c.explainTitle}</h2>
        <p>{c.explain}</p>
        <p className="agent-demo-seed"><span>{c.seedLabel}</span> <code>{c.seed}</code></p>
      </section>

      <section className="detail-surface">
        <div className="detail-surface-header"><h2>{c.twoModes}</h2></div>
        <div className="agent-demo-mode">
          <h3>{c.scriptedTitle}</h3>
          <p>{c.scriptedBody}</p>
        </div>
        <div className="agent-demo-mode agent-demo-mode--live">
          <h3>{c.liveTitle}</h3>
          <p>{c.liveBody}</p>
          <div className="agent-demo-live-controls">
            <label className="agent-demo-hours">
              {c.liveHours}
              <input type="number" min={1} max={240} step={24} value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 72)} />
            </label>
            <button type="button" className="button button-primary" disabled={running} onClick={() => void runLive()}>
              {running ? c.liveRunning : c.liveRun}
            </button>
          </div>
          {started ? (
            <p className="agent-demo-live-started">
              {c.liveStarted} <Link href="/merchant/agents/runs">{c.viewRuns}</Link>
            </p>
          ) : null}
        </div>
      </section>

      <BusinessClock />
    </MobileLayout>
  );
}
