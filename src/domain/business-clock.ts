// Business clock (demo P1) — a stage-safe "sprint clock" for the merchant agent demo.
//
// The most convincing beat of the agent story only exists ACROSS time: the team places an ad on a
// forecast, then 72h later reality diverges, then it revises and remembers. Live-running gemini rounds
// on stage is fragile (latency + measured narration/dead-response failure modes), so this clock STEPS a
// simulated business clock instead: a curated spine faithful to the real finals-a trace (doc 08 §2 —
// real persisted runs), then a deterministic procedural tail so the button never dead-ends ("lifelong").
// Pure + deterministic; the React side is a dumb renderer. The procedural tail is tagged `simulated` so
// a sharp judge can always tell scripted ambient flavor from the real agent-run proof it links to.

import { createRng } from '@/mock/prng';

export type ClockTone = 'plan' | 'measure' | 'revise' | 'ambient';
export type Bilingual = { 'zh-CN': string; en: string };

export type ClockPeriod = {
  /** Days after the demo's Day 0 — drives the displayed sim date. */
  day: number;
  tone: ClockTone;
  label: Bilingual;
  headline: Bilingual;
  detail: Bilingual;
  /** True for the procedural "lifelong" tail — rendered with a 模拟 tag, never mistaken for real runs. */
  simulated: boolean;
};

// The curated spine — a faithful retelling of the real 2026-07-12 finals-a sequence (ADR-0016 v3;
// doc 08 §2). Each beat corresponds to real persisted orchestrator runs.
const SPINE: readonly ClockPeriod[] = [
  {
    day: 0,
    tone: 'plan',
    label: { 'zh-CN': '商业决策', en: 'Decide' },
    headline: {
      'zh-CN': '团队定策：为「薄荷青法式」投放广告，「碎冰玫瑰猫眼」判定不可行',
      en: 'Team decides: advertise “Mint French”, rules “Iced Rose Cat-Eye” infeasible',
    },
    detail: {
      'zh-CN':
        '决策提交 3 份行动简报，风控 [APPROVED]。投广对「薄荷青法式」预测 4.8–7.1 单（CAC ¥808–1211），日预算 ¥12 自动投放；对「碎冰玫瑰猫眼」，三个受众的预测都低于 4 单门槛，带数字判定该简报不可行。钱包 ¥180。',
      en:
        'Decision filed 3 action briefs, risk reviewer [APPROVED]. The ad lane forecast “Mint French” at 4.8–7.1 bookings (CAC ¥808–1211) and auto-launched at ¥12/day; for “Iced Rose Cat-Eye” all three audiences forecast under the 4-booking floor, so it reported the brief infeasible with numbers. Wallet ¥180.',
    },
    simulated: false,
  },
  {
    day: 3,
    tone: 'measure',
    label: { 'zh-CN': '实测回流', en: 'Measure' },
    headline: {
      'zh-CN': '72 小时后：实测获客成本约为预测的 2 倍',
      en: '72h later: real acquisition cost ~2× the forecast',
    },
    detail: {
      'zh-CN':
        '「薄荷青法式」交付 35 次点击（与预测相符），但实测获客成本 ¥1800，远高于 ¥808–1211 的假设。市场比预测更贵——这正是需要监测回流的原因。',
      en:
        '“Mint French” delivered 35 clicks (on forecast) but a real CAC of ¥1800, far above the ¥808–1211 hypothesis. The market was more expensive than predicted — exactly why monitoring feeds back.',
    },
    simulated: false,
  },
  {
    day: 7,
    tone: 'revise',
    label: { 'zh-CN': '修订与记忆', en: 'Revise & remember' },
    headline: {
      'zh-CN': '同一活动改版至第 8 版，监测写入记忆并守住底线',
      en: 'Same campaign → v8; the monitor remembers and holds the line',
    },
    detail: {
      'zh-CN':
        '投广对同一活动原地改版（切换受众）至第 8 版，不另起炉灶。监测写入 3 条实测记忆（含这次 2 倍成本偏差），并援引红线拒绝进一步修订；下一轮决策据此引用记忆。团队跨轮学习。',
      en:
        'The ad lane revised the SAME campaign in place (audience switch) to v8. The monitor wrote 3 measured memories (including this 2× cost miss) and refused a further revision citing its bright lines; the next round cites that memory. The team learns across rounds.',
    },
    simulated: false,
  },
];

const SPINE_DAYS = SPINE.map((p) => p.day);
const STEP_DAYS = 3;

/** The procedural "lifelong" tail — deterministic ambient operations from a seeded PRNG, so the clock
 *  never dead-ends. Tagged `simulated`. */
export function proceduralPeriod(index: number): ClockPeriod {
  const rng = createRng(9973 + index * 101);
  const day = SPINE_DAYS[SPINE_DAYS.length - 1] + (index - SPINE.length + 1) * STEP_DAYS;
  const impressions = rng.int(280, 520);
  const bookings = rng.int(4, 13);
  const action = rng.weighted<Bilingual>([
    [{ 'zh-CN': '维持当前投放，继续观察', en: 'held the current placement and kept watching' }, 3],
    [{ 'zh-CN': '小幅上调「薄荷青法式」的日预算', en: 'nudged “Mint French” daily budget up' }, 2],
    [{ 'zh-CN': '对一款高意向低转化款试价', en: 'price-tested a high-interest, low-conversion style' }, 2],
    [{ 'zh-CN': '为一位流失顾客起草召回私信', en: 'drafted a win-back message for a lapsed customer' }, 1],
  ]);
  return {
    day,
    tone: 'ambient',
    label: { 'zh-CN': '日常运营', en: 'Ongoing ops' },
    headline: {
      'zh-CN': `本期约 ${impressions} 次曝光 · ${bookings} 单预约`,
      en: `~${impressions} impressions · ${bookings} bookings this period`,
    },
    detail: {
      'zh-CN': `团队${action['zh-CN']}。（模拟：由种子确定性生成，用于演示"永远在运行"，非真实 Agent 运行）`,
      en: `The team ${action.en}. (Simulated: deterministically seeded to show the system "always running", not a real agent run.)`,
    },
    simulated: true,
  };
}

/** The period at a given index — curated spine first, then the procedural tail. */
export function getPeriod(index: number): ClockPeriod {
  return index < SPINE.length ? SPINE[index] : proceduralPeriod(index);
}

/** Periods 0..count-1 (oldest first). `count` is how many the presenter has revealed (min 1). */
export function revealedPeriods(count: number): ClockPeriod[] {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => getPeriod(i));
}

export const SPINE_LENGTH = SPINE.length;
