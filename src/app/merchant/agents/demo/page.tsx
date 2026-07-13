'use client';

import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { BusinessClock } from '@/features/merchant/BusinessClock';
import { useLanguage } from '@/i18n/context';
import type { AppLanguage } from '@/i18n/types';

const copy = {
  'zh-CN': {
    eyebrow: 'Nailed AI · 演示控制台',
    title: '演示控制台',
    body: '仅用于现场演示，商家日常不会看到这里。',
    back: '← 返回运营团队',
    explainTitle: '推进时钟 ≠ AI 推理',
    explain: '推进业务时钟只是「模拟市场结算」——用确定性数学把 72/96 小时的曝光、点击、预约、花费累加到活动上，全过程没有任何 AI 推理。真正的判断发生在下一轮运行时：代理团队读取这些结算结果，才做出诊断、修订与记忆。同一场景种子 → 同一结果，演示可复现。',
    seedLabel: '场景种子',
    seed: 'finals-a（隐藏市场：泛流量质量 0.55 · 转化摩擦 1.40 · 高意向 1.35）',
  },
  en: {
    eyebrow: 'Nailed AI · Demo console',
    title: 'Demo console',
    body: 'Stage-only. Merchants never see this in normal use.',
    back: '← Back to agent team',
    explainTitle: 'Advancing the clock ≠ AI reasoning',
    explain: 'Advancing the clock is pure market SETTLEMENT — deterministic math that accumulates 72/96h of impressions, clicks, bookings and spend onto campaigns. No AI runs during this step. The reasoning happens on the NEXT round, when the team reads these settled numbers and diagnoses, revises, and remembers. Same scenario seed → same result — reproducible on stage.',
    seedLabel: 'Scenario seed',
    seed: 'finals-a (hidden market: broad quality 0.55 · booking friction 1.40 · high-intent 1.35)',
  },
} satisfies Record<AppLanguage, Record<string, string>>;

export default function MerchantAgentDemoPage() {
  const { language } = useLanguage();
  const c = copy[language];
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

      <BusinessClock />
    </MobileLayout>
  );
}
