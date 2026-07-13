# 拼贴小屋 AI 加载界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用一个与拼贴小屋视觉统一、带互动小游戏的独立组件 `<NailLoadingScreen>` 替换现有单调的加载动画。

**Architecture:** 新增独立组件 `src/features/customer/NailLoadingScreen.tsx`,三层结构(背景印花层 / 中央小游戏 / 顶部进度与文案)。样式集中放 `globals.css`,复用现有米色+金色 token。纯 CSS 动画(项目无 Framer Motion)。进度条曲线是纯函数,单测覆盖;视觉效果用浏览器(playwright MCP,端口 3007)实测确认。分两阶段交付:阶段一(视觉+背景+进度+文案)先给用户确认,阶段二(小游戏+转场)。

**Tech Stack:** Next.js 15 · React · TypeScript · 纯 CSS animation · Vitest(纯函数单测)· Playwright MCP(视觉验证)

**验证约定:** dev server 跑在 `localhost:3007`(端口 3000 被别的项目占用)。进入路径:`/customer/home` → 点"拼贴小屋"→ 点"AI 生成美甲效果图"进入 loading。视觉步骤用 playwright MCP 打开该 URL、驱动到 loading 态、`browser_evaluate` 读计算样式 + `browser_take_screenshot` 截图确认。

---

## 设计 token(来自 `src/app/globals.css`,实现时照抄,勿重新配色)

- 米色渐变 A:`linear-gradient(160deg, #fdf6ec 0%, #f5efe0 60%, #ede8d8 100%)`
- 米色渐变 B(呼吸暗态):`linear-gradient(160deg, #fbf1e3 0%, #f0e8d5 60%, #e6dfcb 100%)`
- 金色:`rgba(196, 146, 42, <a>)`;文字金 `#c4922a`
- 圆角:`--radius-lg`(20px)、`--radius-md`(8px)、`--radius-pill`
- 缓动:`--motion-ease: cubic-bezier(0.22, 0.61, 0.36, 1)`
- 印花 emoji 池(用户已确认,不含 💎):💅 ✨ 🩷 ⭐ 🎀
- 轮播文案(4 条):
  1. 正在为你的手涂上第一层色彩…
  2. 正在调和你的专属色调…
  3. 正在点缀闪耀的细节…
  4. 马上就要完成啦…

## 文件结构

- Create: `src/features/customer/NailLoadingScreen.tsx` — 加载界面组件(三层 + 进度/文案 hooks)
- Create: `src/features/customer/loading-progress.ts` — 纯函数 `computeFakeProgress(elapsedMs, done)` 进度曲线
- Create: `src/features/customer/loading-progress.test.ts` — 进度曲线单测
- Modify: `src/features/customer/CollageHousePanel.tsx` — 用 `<NailLoadingScreen>` 替换内联 `LoadingScreen`,接线 `done`/`onTransitionEnd`
- Modify: `src/app/globals.css` — 新增 `.nail-loading*` 样式;删除弃用的 `.collage-loading-*`

---

# 阶段一:视觉风格 + 背景动效 + 进度条 + 文案轮播

## Task 1: 进度曲线纯函数 + 单测

进度曲线是纯逻辑,先 TDD。曲线:0→90% 约 15s(ease-out 感),90%→95% 渐近(永不超 95%),`done` 时直接返回 100。

**Files:**
- Create: `src/features/customer/loading-progress.ts`
- Test: `src/features/customer/loading-progress.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/customer/loading-progress.test.ts
import { describe, it, expect } from 'vitest';
import { computeFakeProgress } from './loading-progress';

describe('computeFakeProgress', () => {
  it('starts at 0 at elapsed 0', () => {
    expect(computeFakeProgress(0, false)).toBe(0);
  });

  it('reaches ~90 by 15s (within tolerance)', () => {
    const p = computeFakeProgress(15_000, false);
    expect(p).toBeGreaterThanOrEqual(88);
    expect(p).toBeLessThanOrEqual(90);
  });

  it('asymptotes below 95 no matter how long', () => {
    expect(computeFakeProgress(60_000, false)).toBeLessThan(95);
    expect(computeFakeProgress(600_000, false)).toBeLessThan(95);
  });

  it('is monotonically non-decreasing over the pre-done range', () => {
    let prev = -1;
    for (let t = 0; t <= 60_000; t += 500) {
      const p = computeFakeProgress(t, false);
      expect(p).toBeGreaterThanOrEqual(prev);
      prev = p;
    }
  });

  it('returns 100 immediately when done is true', () => {
    expect(computeFakeProgress(0, true)).toBe(100);
    expect(computeFakeProgress(3_000, true)).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20 --silent && npx vitest run src/features/customer/loading-progress.test.ts`
Expected: FAIL — `computeFakeProgress` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/customer/loading-progress.ts

/**
 * Fake loading progress curve (0–100), decoupled from real AI progress.
 * - 0 → 90 over ~15s with an ease-out feel (fast then slow).
 * - 90 → asymptotically approaches (but never reaches) 95.
 * - When `done`, jumps straight to 100.
 * Pure function: safe to unit-test and call every rAF tick.
 */
export function computeFakeProgress(elapsedMs: number, done: boolean): number {
  if (done) return 100;

  const RAMP_MS = 15_000; // time to reach ~90%
  const t = Math.max(0, elapsedMs);

  if (t <= RAMP_MS) {
    // ease-out: fast start, slow finish, hits 90 at RAMP_MS
    const x = t / RAMP_MS;          // 0..1
    const eased = 1 - Math.pow(1 - x, 2); // easeOutQuad
    return eased * 90;
  }

  // after ramp: asymptote from 90 toward 95, never crossing it
  const over = t - RAMP_MS;
  const approach = 1 - Math.exp(-over / 20_000); // 0..1 slowly
  return 90 + approach * 5; // 90 → <95
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/customer/loading-progress.test.ts`
Expected: PASS (5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/features/customer/loading-progress.ts src/features/customer/loading-progress.test.ts
git commit -m "feat: add fake loading progress curve + tests"
```

---

## Task 2: NailLoadingScreen 组件骨架 + 背景呼吸层

先搭组件外壳与米色呼吸背景,不含印花/进度/游戏。此时组件可渲染。

**Files:**
- Create: `src/features/customer/NailLoadingScreen.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create component skeleton**

```tsx
// src/features/customer/NailLoadingScreen.tsx
'use client';

type NailLoadingScreenProps = {
  done: boolean;
  onTransitionEnd: () => void;
};

export function NailLoadingScreen({ done, onTransitionEnd }: NailLoadingScreenProps) {
  // done / onTransitionEnd wired in later tasks (Task 5)
  void done;
  void onTransitionEnd;
  return (
    <div className="nail-loading" role="status" aria-label="正在生成美甲效果图" aria-live="polite">
      {/* BgPrintLayer — Task 3 */}
      {/* PolishGame placeholder — Task 3 / Phase 2 */}
      {/* LoadingStatus — Task 4 */}
    </div>
  );
}
```

- [ ] **Step 2: Add breathing-background CSS**

Append near the existing `.collage-loading-*` block in `src/app/globals.css`:

```css
/* ── Nail loading screen ─────────────────────────────────────────────────── */
.nail-loading {
  position: absolute;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  background: linear-gradient(160deg, #fdf6ec 0%, #f5efe0 60%, #ede8d8 100%);
  background-size: 200% 200%;
  animation: nailBgBreathe 10s ease-in-out infinite;
}
@keyframes nailBgBreathe {
  0%   { background-position: 0% 0%;   }
  50%  { background-position: 100% 100%; }
  100% { background-position: 0% 0%;   }
}
/* subtle darker-beige veil that fades in/out for the "breathing" tone shift */
.nail-loading::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(160deg, #fbf1e3 0%, #f0e8d5 60%, #e6dfcb 100%);
  opacity: 0;
  animation: nailVeilBreathe 10s ease-in-out infinite;
  pointer-events: none;
}
@keyframes nailVeilBreathe {
  0%, 100% { opacity: 0; }
  50%      { opacity: 0.6; }
}
```

- [ ] **Step 3: Wire component into CollageHousePanel (temporary, for viewing)**

In `src/features/customer/CollageHousePanel.tsx`, add import and swap the loading branch:

```tsx
import { NailLoadingScreen } from './NailLoadingScreen';
```

Replace the existing loading branch:

```tsx
  if (genState.phase === 'loading') {
    const ls = <NailLoadingScreen done={false} onTransitionEnd={() => {}} />;
    return shellEl ? createPortal(ls, shellEl) : ls;
  }
```

(Full `done`/`onTransitionEnd` wiring happens in Task 5.)

- [ ] **Step 4: Verify in browser**

Ensure dev server up: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3007/customer/home` → `200` (if not, start: `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20 --silent && PORT=3007 npx next dev -p 3007 > /tmp/nailedit-dev.log 2>&1 &`).

Via playwright MCP: navigate to `http://localhost:3007/customer/home`, resize 414×896, click 拼贴小屋 entry, click AI 生成 button, then `browser_evaluate`:

```js
() => {
  const el = document.querySelector('.nail-loading');
  const s = el && getComputedStyle(el);
  return { exists: !!el, hasBreatheAnim: s?.animationName?.includes('nailBgBreathe'), bg: s?.backgroundImage?.slice(0,40) };
}
```
Expected: `exists: true`, `hasBreatheAnim: true`, bg contains `linear-gradient`. Screenshot to confirm beige tone matches the studio overlay.

- [ ] **Step 5: Commit**

```bash
git add src/features/customer/NailLoadingScreen.tsx src/app/globals.css src/features/customer/CollageHousePanel.tsx
git commit -m "feat: add NailLoadingScreen skeleton with breathing beige background"
```

---

## Task 3: 印花壁纸层(BgPrintLayer)

低透明度 emoji 印花,上下浮动 + 清晰度渐变(blur/opacity 呼吸),**不旋转、无单独闪烁**。

**Files:**
- Modify: `src/features/customer/NailLoadingScreen.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add BgPrintLayer to component**

In `NailLoadingScreen.tsx`, add above the component and render it inside `.nail-loading`:

```tsx
// 10 prints scattered around the edges (avoid the central game zone).
// [emoji, top%, left%, sizeRem, delaySec]
const PRINTS: [string, number, number, number, number][] = [
  ['💅', 8,  6,  2.2, 0],
  ['✨', 14, 82, 1.4, 1.1],
  ['🩷', 24, 14, 1.8, 2.3],
  ['⭐', 6,  46, 1.3, 0.6],
  ['🎀', 30, 78, 2.0, 1.7],
  ['✨', 70, 8,  1.5, 3.1],
  ['💅', 82, 84, 2.4, 0.9],
  ['🩷', 88, 30, 1.6, 2.0],
  ['⭐', 64, 88, 1.3, 1.4],
  ['🎀', 76, 50, 1.9, 2.7],
];

function BgPrintLayer() {
  return (
    <div className="nail-loading-prints" aria-hidden="true">
      {PRINTS.map(([emoji, top, left, size, delay], i) => (
        <span
          key={i}
          className="nail-loading-print"
          style={{
            top: `${top}%`,
            left: `${left}%`,
            fontSize: `${size}rem`,
            animationDelay: `${delay}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
```

Render inside `.nail-loading` (first child):

```tsx
    <div className="nail-loading" role="status" aria-label="正在生成美甲效果图" aria-live="polite">
      <BgPrintLayer />
      {/* LoadingStatus — Task 4 */}
    </div>
```

- [ ] **Step 2: Add print CSS (float + clarity-breathe, no rotation)**

Append to `src/app/globals.css`:

```css
.nail-loading-prints {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.nail-loading-print {
  position: absolute;
  line-height: 1;
  will-change: transform, opacity, filter;
  animation: nailPrintFloat 8s ease-in-out infinite;
}
@keyframes nailPrintFloat {
  0%, 100% { transform: translateY(0);     opacity: 0.06; filter: blur(1.2px); }
  50%      { transform: translateY(-8px);  opacity: 0.18; filter: blur(0);     }
}
```

- [ ] **Step 3: Verify in browser**

Drive to loading state (Task 2 Step 4 path), then `browser_evaluate`:

```js
() => {
  const prints = [...document.querySelectorAll('.nail-loading-print')];
  const s = prints[0] && getComputedStyle(prints[0]);
  return {
    count: prints.length,
    animName: s?.animationName,
    hasRotate: /rotate/i.test(s?.animationName || '') || /rotate/i.test(s?.transform || ''),
  };
}
```
Expected: `count: 10`, `animName` includes `nailPrintFloat`, `hasRotate: false`. Screenshot: prints faint, scattered, not covering center.

- [ ] **Step 4: Commit**

```bash
git add src/features/customer/NailLoadingScreen.tsx src/app/globals.css
git commit -m "feat: add floating low-opacity emoji print layer (no rotation)"
```

---

## Task 4: 顶部标题 + 进度条 + 文案轮播(LoadingStatus)

顶部中文标题"拼贴小屋"、金色假进度条(rAF 驱动、用 Task 1 曲线)、3.5s 淡入淡出轮播文案。

**Files:**
- Modify: `src/features/customer/NailLoadingScreen.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add status UI + hooks to component**

Add imports at top of `NailLoadingScreen.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { computeFakeProgress } from './loading-progress';
```

Add the phrase list near `PRINTS`:

```tsx
const LOADING_PHRASES = [
  '正在为你的手涂上第一层色彩…',
  '正在调和你的专属色调…',
  '正在点缀闪耀的细节…',
  '马上就要完成啦…',
];
```

Inside the component body, add progress (rAF) + phrase rotation:

```tsx
  const [progress, setProgress] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // rAF progress loop — only mutates one width value, no setInterval DOM thrash
  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      setProgress(computeFakeProgress(elapsed, done));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [done]);

  // phrase rotation every 3.5s
  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % LOADING_PHRASES.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);
```

Render the status block inside `.nail-loading`, after `<BgPrintLayer />`:

```tsx
      <div className="nail-loading-status">
        <span className="nail-loading-eyebrow">NAIL STUDIO</span>
        <h1 className="nail-loading-title">拼贴小屋</h1>
        <p key={phraseIdx} className="nail-loading-phrase">{LOADING_PHRASES[phraseIdx]}</p>
        <div className="nail-loading-bar" aria-hidden="true">
          <div className="nail-loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
```

- [ ] **Step 2: Add status CSS**

Append to `src/app/globals.css`:

```css
.nail-loading-status {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 20rem;
  margin-top: 3.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 1rem;
}
.nail-loading-eyebrow {
  font-size: var(--text-xs);
  letter-spacing: 0.28em;
  color: rgba(196, 146, 42, 0.75);
  font-weight: 700;
}
.nail-loading-title {
  margin: 0.15rem 0 0.9rem;
  font-size: var(--text-xl);
  font-weight: 800;
  color: #6b4c1a;
}
.nail-loading-phrase {
  margin: 0 0 0.9rem;
  min-height: 1.2em;
  font-size: var(--text-sm);
  color: #9a8a72;
  animation: nailPhraseFade 3.5s ease-in-out;
}
@keyframes nailPhraseFade {
  0%   { opacity: 0; transform: translateY(4px); }
  12%  { opacity: 1; transform: translateY(0);   }
  88%  { opacity: 1; transform: translateY(0);   }
  100% { opacity: 0; transform: translateY(-4px);}
}
.nail-loading-bar {
  width: 100%;
  height: 6px;
  border-radius: var(--radius-pill);
  background: rgba(196, 146, 42, 0.15);
  overflow: hidden;
}
.nail-loading-bar-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: linear-gradient(90deg, rgba(196, 146, 42, 0.5), #c4922a);
  transition: width 0.15s linear;
}
```

- [ ] **Step 3: Verify in browser**

Drive to loading state. `browser_evaluate` twice ~2s apart to confirm progress advances:

```js
() => {
  const fill = document.querySelector('.nail-loading-bar-fill');
  const phrase = document.querySelector('.nail-loading-phrase');
  const title = document.querySelector('.nail-loading-title');
  return { title: title?.textContent, width: fill?.style.width, phrase: phrase?.textContent };
}
```
Expected: `title: "拼贴小屋"`, `width` increases between calls (e.g. "12%" → "34%"), `phrase` is one of the 4. Screenshot to confirm layout + gold bar.

- [ ] **Step 4: Commit**

```bash
git add src/features/customer/NailLoadingScreen.tsx src/app/globals.css
git commit -m "feat: add title, gold fake-progress bar (rAF), rotating phrases"
```

---

## Task 5: 静态瓶子占位 + 阶段一收尾接线

阶段一中央放静态瓶子占位。此任务先接最简 `onTransitionEnd`(不含转场动画,阶段二再做),保证 `done` 时能切结果页,阶段一可独立跑通。

**Files:**
- Modify: `src/features/customer/NailLoadingScreen.tsx`
- Modify: `src/features/customer/CollageHousePanel.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add static bottle placeholder**

Render inside `.nail-loading`, between status and prints (center area):

```tsx
      <div className="nail-loading-bottle" aria-hidden="true">
        <div className="nail-loading-bottle-cap" />
        <div className="nail-loading-bottle-body">
          <div className="nail-loading-bottle-fill" style={{ height: '55%' }} />
        </div>
      </div>
```

- [ ] **Step 2: Add bottle CSS (static placeholder)**

```css
.nail-loading-bottle {
  position: relative;
  z-index: 2;
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.nail-loading-bottle-cap {
  width: 26px;
  height: 34px;
  border-radius: 6px 6px 4px 4px;
  background: linear-gradient(180deg, #d8b25a, #b98e2e);
  box-shadow: 0 2px 6px rgba(120, 80, 20, 0.25);
}
.nail-loading-bottle-body {
  width: 72px;
  height: 96px;
  margin-top: -4px;
  border-radius: 10px 10px 14px 14px;
  background: rgba(255, 255, 255, 0.55);
  border: 1.5px solid rgba(196, 146, 42, 0.4);
  box-shadow: var(--shadow-raised);
  overflow: hidden;
  display: flex;
  align-items: flex-end;
}
.nail-loading-bottle-fill {
  width: 100%;
  background: linear-gradient(180deg, #ec5d7b, #c73963);
  transition: height 0.25s ease;
}
```

- [ ] **Step 3: Wire done/onTransitionEnd in CollageHousePanel**

In `CollageHousePanel.tsx`, keep `genState` as-is but split loading vs done so the loading screen owns the transition. Replace the loading + done branches:

```tsx
  if (genState.phase === 'loading' || genState.phase === 'done') {
    const ls = (
      <NailLoadingScreen
        done={genState.phase === 'done'}
        onTransitionEnd={() => setShowResult(true)}
      />
    );
    // once transition finished and we have the image, show result
    if (showResult && genState.phase === 'done') {
      const rs = (
        <ResultScreen
          imageBase64={genState.imageBase64}
          onRetry={() => { setGenState({ phase: 'idle' }); setDecals([]); setExtraText(''); setShowResult(false); }}
          onBreakdown={() => router.push(getCustomerBookingPath())}
          onTryOn={() => router.push(getCustomerTryOnPath())}
          onClose={() => { setOpen(false); setGenState({ phase: 'idle' }); setShowResult(false); }}
        />
      );
      return shellEl ? createPortal(rs, shellEl) : rs;
    }
    return shellEl ? createPortal(ls, shellEl) : ls;
  }
```

Add the `showResult` state near the other `useState`s:

```tsx
  const [showResult, setShowResult] = useState(false);
```

In `NailLoadingScreen`, call `onTransitionEnd` once when `done` becomes true (Phase 1: immediate; Phase 2 will delay it behind the transition animation):

```tsx
  useEffect(() => {
    if (done) onTransitionEnd();
  }, [done, onTransitionEnd]);
```

Remove the now-unused `void done; void onTransitionEnd;` lines.

- [ ] **Step 4: Verify end-to-end in browser**

Drive to loading; because the AI call really runs, wait for it (or confirm the loading UI holds while pending). `browser_evaluate`:

```js
() => ({
  bottle: !!document.querySelector('.nail-loading-bottle'),
  fillH: document.querySelector('.nail-loading-bottle-fill')?.style.height,
})
```
Expected: `bottle: true`, `fillH: "55%"`. Let a real generation finish → confirm it transitions to `.collage-result-screen`. Screenshot the full phase-1 loading screen.

- [ ] **Step 5: Commit**

```bash
git add src/features/customer/NailLoadingScreen.tsx src/features/customer/CollageHousePanel.tsx src/app/globals.css
git commit -m "feat: static polish-bottle placeholder + wire done/result transition"
```

---

## ⏸ 阶段一交付确认点

阶段一完成后,**暂停并请用户在浏览器确认视觉**(背景呼吸、印花、标题"拼贴小屋"、进度条推进、文案轮播、静态瓶子)。用户确认后再做阶段二。

---

# 阶段二:互动小游戏 + 完成转场

## Task 6: PolishGame — 点击填色 + 摇晃

把静态瓶子替换为可点击组件:点击 → 瓶身摇晃 + 填充上升;填满 → 高光呼吸 → 清空换色循环。

**Files:**
- Modify: `src/features/customer/NailLoadingScreen.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add PolishGame component**

Add colour cycle + component in `NailLoadingScreen.tsx`:

```tsx
const BOTTLE_COLORS = [
  ['#ec5d7b', '#c73963'], // 粉
  ['#e6c9a8', '#c99a63'], // 裸
  ['#e5484d', '#b91c1c'], // 红
  ['#a78bda', '#7c5bd0'], // 紫
];

function PolishGame() {
  const [fill, setFill] = useState(0);        // 0..100
  const [colorIdx, setColorIdx] = useState(0);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);

  const onPoke = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 220);
    setFill((prev) => {
      const next = prev + 12;
      if (next >= 100) {
        // full → highlight breathe → reset + next colour
        setFlash(true);
        window.setTimeout(() => {
          setFlash(false);
          setFill(0);
          setColorIdx((c) => (c + 1) % BOTTLE_COLORS.length);
        }, 500);
        return 100;
      }
      return next;
    });
  };

  const [top, bottom] = BOTTLE_COLORS[colorIdx];

  return (
    <button
      type="button"
      className={`nail-loading-bottle nail-loading-bottle-btn${shake ? ' is-shaking' : ''}${flash ? ' is-flashing' : ''}`}
      onClick={onPoke}
      aria-label="点击摇一摇指甲油"
    >
      <span className="nail-loading-bottle-cap" aria-hidden="true" />
      <span className="nail-loading-bottle-body" aria-hidden="true">
        <span
          className="nail-loading-bottle-fill"
          style={{ height: `${fill}%`, backgroundImage: `linear-gradient(180deg, ${top}, ${bottom})` }}
        />
      </span>
    </button>
  );
}
```

Replace the static bottle markup from Task 5 with `<PolishGame />`.

- [ ] **Step 2: Add shake + flash CSS**

```css
.nail-loading-bottle-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.nail-loading-bottle-btn.is-shaking {
  animation: nailBottleShake 0.22s ease-in-out;
}
@keyframes nailBottleShake {
  0%, 100% { transform: rotate(0); }
  25%      { transform: rotate(-7deg); }
  75%      { transform: rotate(7deg); }
}
.nail-loading-bottle-btn.is-flashing .nail-loading-bottle-body {
  animation: nailBottleFlash 0.5s ease-in-out;
}
@keyframes nailBottleFlash {
  0%, 100% { box-shadow: var(--shadow-raised); filter: brightness(1); }
  50%      { box-shadow: 0 0 16px 4px rgba(255, 220, 150, 0.9); filter: brightness(1.12); }
}
```

- [ ] **Step 3: Verify interaction in browser**

Drive to loading. Click the bottle several times via playwright, then `browser_evaluate`:

```js
() => ({
  fillH: document.querySelector('.nail-loading-bottle-fill')?.style.height,
  bg: document.querySelector('.nail-loading-bottle-fill')?.style.backgroundImage?.slice(0, 30),
})
```
Expected: after N clicks, `fillH` grows in 12% steps; after crossing 100 it resets toward 0 and `bg` (colour) changes. Screenshot mid-fill.

- [ ] **Step 4: Commit**

```bash
git add src/features/customer/NailLoadingScreen.tsx src/app/globals.css
git commit -m "feat: interactive polish-bottle fill game with shake + colour cycle"
```

---

## Task 7: 完成转场动画

`done` 时不再立即回调:先让进度跳 100%,短暂停顿,再 fade+缩放整个加载层,动画结束后才 `onTransitionEnd`。

**Files:**
- Modify: `src/features/customer/NailLoadingScreen.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace immediate callback with transition**

In `NailLoadingScreen`, replace the Task-5 `useEffect(() => { if (done) onTransitionEnd(); })` with a delayed, animated exit:

```tsx
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!done) return;
    // brief pause so the bar can visibly hit 100%, then play exit animation
    const pause = window.setTimeout(() => setLeaving(true), 450);
    return () => window.clearTimeout(pause);
  }, [done]);

  const handleExitAnimEnd = () => {
    if (leaving) onTransitionEnd();
  };
```

Add `is-leaving` class + `onAnimationEnd` to the root:

```tsx
    <div
      className={`nail-loading${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-label="正在生成美甲效果图"
      aria-live="polite"
      onAnimationEnd={handleExitAnimEnd}
    >
```

Note: root already has `nailBgBreathe` animation, so guard `handleExitAnimEnd` by checking the class (`leaving`) — only fire the callback for the exit. To avoid the breathe animation's `animationend` never firing (infinite) it's fine, but to be safe, match the animation name:

```tsx
  const handleExitAnimEnd = (e: React.AnimationEvent) => {
    if (leaving && e.animationName === 'nailLoadingExit') onTransitionEnd();
  };
```

- [ ] **Step 2: Add exit animation CSS**

```css
.nail-loading.is-leaving {
  animation: nailLoadingExit 0.6s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
}
@keyframes nailLoadingExit {
  from { opacity: 1; transform: scale(1);    }
  to   { opacity: 0; transform: scale(1.04); }
}
```

- [ ] **Step 3: Verify transition in browser**

Trigger a real generation; when it completes, confirm: bar hits 100%, then the layer fades/scales out, then `.collage-result-screen` appears. Because timing is async, capture a screenshot right after completion and confirm no hard cut. `browser_evaluate` right after done:

```js
() => ({
  leaving: !!document.querySelector('.nail-loading.is-leaving'),
  result: !!document.querySelector('.collage-result-screen'),
})
```
Expected: transiently `leaving: true`, then `result: true`.

- [ ] **Step 4: Commit**

```bash
git add src/features/customer/NailLoadingScreen.tsx src/app/globals.css
git commit -m "feat: soft fade+scale transition from loading to result"
```

---

## Task 8: 清理弃用样式 + reduced-motion 降级

删除旧 `.collage-loading-*` 样式与旧 `LoadingScreen`(确认无别处引用);加 `prefers-reduced-motion` 降级。

**Files:**
- Modify: `src/features/customer/CollageHousePanel.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Confirm old LoadingScreen unused**

Run: `grep -rn "LoadingScreen\|collage-loading" src --include="*.tsx" --include="*.css"`
Expected: only references are the new `NailLoadingScreen`. The old `function LoadingScreen()` in `CollageHousePanel.tsx` and `.collage-loading-*` CSS are orphaned.

- [ ] **Step 2: Delete old LoadingScreen function**

In `CollageHousePanel.tsx`, delete the entire `function LoadingScreen() { ... }` block and its `LOADING_EMOJIS` usage if now unused (check: `grep -n "LOADING_EMOJIS" src/features/customer/CollageHousePanel.tsx`; remove the const if no remaining refs).

- [ ] **Step 3: Delete orphaned CSS**

In `globals.css`, delete the `.collage-loading-*` rule block (the old orbit/ring/disc loader). Keep `.collage-bg-sparkle*` if still used by `ResultScreen` (verify: `grep -n "collage-bg-sparkle" src/features/customer/CollageHousePanel.tsx` — ResultScreen uses it, so keep).

- [ ] **Step 4: Add reduced-motion fallback**

Append to `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .nail-loading,
  .nail-loading::before,
  .nail-loading-print,
  .nail-loading-phrase,
  .nail-loading-bottle-btn.is-shaking,
  .nail-loading.is-leaving {
    animation: none !important;
  }
  .nail-loading::before { opacity: 0.3; }
  .nail-loading-print { opacity: 0.12; filter: none; }
}
```

- [ ] **Step 5: Verify build + tests + browser**

Run: `npx vitest run src/features/customer/loading-progress.test.ts` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -c "NailLoadingScreen\|CollageHousePanel"` → `0`.
Browser: full run once more, confirm nothing visually broke.

- [ ] **Step 6: Commit**

```bash
git add src/features/customer/CollageHousePanel.tsx src/app/globals.css
git commit -m "chore: remove old orbit loader, add reduced-motion fallback"
```

---

## Self-Review 结果

- **Spec 覆盖**:背景呼吸(T2)、印花浮动+清晰度渐变无旋转(T3)、标题"拼贴小屋"(T4)、假进度曲线 15s→90%→<95→done100(T1+T4)、文案轮播 3.5s(T4)、静态瓶占位(T5)、瓶子填色循环换色+高光呼吸(T6)、完成转场 fade+scale 0.6s(T7)、父组件接线(T5)、性能 transform/opacity + rAF 清理(T1/T4)、reduced-motion + aria(T2/T8)、删除旧样式(T8)、印花池已去 💎(token 段)—— 全部覆盖。
- **Placeholder 扫描**:无 TBD/TODO;所有代码步骤含完整代码。
- **类型一致性**:`computeFakeProgress(elapsedMs, done)` 签名 T1 定义、T4 使用一致;`NailLoadingScreenProps { done, onTransitionEnd }` T2 定义、T5/T7 使用一致;`showResult` state T5 引入并在同任务使用;class 名 `nail-loading*` 全程一致。
