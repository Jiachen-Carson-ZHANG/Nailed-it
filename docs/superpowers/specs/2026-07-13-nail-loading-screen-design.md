# 拼贴小屋 AI 加载界面 — 设计 spec

日期:2026-07-13
范围:优化"AI 生成美甲效果图"的加载过程,替换现有单调的 `LoadingScreen`,做成与拼贴小屋视觉统一、带互动小游戏的独立组件。

## 目标

- 视觉与拼贴小屋工作台 (`.studio-overlay`) 完全统一(米色 + 金色体系)。
- 背景柔和动态(呼吸 + 印花浮动),不喧宾夺主。
- 中央互动小游戏(指甲油瓶填色)消磨等待时间,纯前端、不掉帧。
- 半联动进度条 + 轮播文案 让用户感知"AI 正在工作"。
- 完成后柔和转场到结果页。

## 从现有代码提取的设计 token(不新增设计规范)

来源:`src/app/globals.css`

- 米色背景渐变(= `.studio-overlay` line 6466):`linear-gradient(160deg, #fdf6ec 0%, #f5efe0 60%, #ede8d8 100%)`
- 金色描边/填充:`rgba(196, 146, 42, <a>)`;文字金 `#c4922a`
- 圆角:`--radius-lg: 1.25rem`(卡片/弹层)、`--radius-md: 0.5rem`(按钮)、`--radius-pill: 999px`
- 字体:`Inter, -apple-system, ...`(继承 body)
- 缓动:`--motion-ease: cubic-bezier(0.22, 0.61, 0.36, 1)`
- **约束:项目未安装 Framer Motion → 全部用纯 CSS animation 实现。**
- 转场参考:现有 `studioPopupIn` keyframe(fade + scale)。

## 组件结构

新增独立组件 `src/features/customer/NailLoadingScreen.tsx`,替换 `CollageHousePanel.tsx` 中的内联 `LoadingScreen`。

对外接口:

```tsx
<NailLoadingScreen
  done={boolean}              // 外部:AI 是否真的生成完成(由 genState.phase === 'done' 驱动)
  onTransitionEnd={() => {}}  // 进度跳 100% + 转场动画播完后回调,由父组件切到 ResultScreen
/>
```

内部三层(职责隔离,`pointer-events` 分层):

```
<div class="nail-loading">              背景层:米色渐变 + 缓慢呼吸
  ├─ BgPrintLayer   印花壁纸层           pointer-events:none;低透明度 emoji;上下浮动 + 清晰度渐变(不旋转)
  ├─ PolishGame     中央小游戏           阶段一为静态占位瓶;阶段二为可点击填色
  └─ LoadingStatus  顶部标题+进度条+文案   假进度条 + 3.5s 轮播文案
```

## 分两阶段交付

### 阶段一:视觉风格 + 背景动效 + 进度条 + 文案轮播(先交付确认)

1. **背景呼吸**:10s 周期,ease-in-out,无限循环,两个相近米色渐变间过渡。
   - A 态:`linear-gradient(160deg, #fdf6ec 0%, #f5efe0 60%, #ede8d8 100%)`
   - B 态:`linear-gradient(160deg, #fbf1e3 0%, #f0e8d5 60%, #e6dfcb 100%)`(各停靠点调暗 ~3-4%)
   - 实现:`background-size: 200% 200%` + `@keyframes` 位移 `background-position`,只动 GPU 友好属性。

2. **印花壁纸层**:emoji 印花,`opacity` 基线 ~0.12,`pointer-events:none`。
   - 元素池:💅 ✨ 🩷 ⭐ 🎀 
   - 约 10-12 个散布四周(避开中央游戏区),大小 `1.2rem–2.4rem`。
   - 每个动画:**上下浮动(±8px)+ 清晰度渐变**(opacity 在 ~0.06↔0.18 之间、配合极轻微 blur 呼吸),`7-9s` 随机周期,`ease-in-out`,交错 `animation-delay`。
   - **不做旋转。不做单独的星星闪烁。**

3. **顶部标题**:沿用现有加载页排版(eyebrow `NAIL STUDIO` + 大标题),大标题文案改为中文 **"拼贴小屋"**;配色换到米色/金色。

4. **假进度条**:顶部标题下方,细条,`--radius-pill`,金色填充 `linear-gradient(90deg, rgba(196,146,42,.5), #c4922a)`,轨道浅米色。
   - 曲线(JS `requestAnimationFrame` 驱动,只改一个 `width`,不用 setInterval 频繁操作 DOM):
     - 0 → 90%:约 15s,ease-out 感(前快后慢)。
     - 90% → 95%:渐近爬升,永远卡在 95% 以内。
     - `done === true`:立即推进到 100%。
     - 若 15s 内 `done` 就为真:直接跳 100%,不硬等。
   - 不显示百分比数字。

5. **文案轮播**:进度条上方灰字小字,每 3.5s 切换 + 淡入淡出,循环:
   1. "正在为你的手涂上第一层色彩…"
   2. "正在调和你的专属色调…"
   3. "正在点缀闪耀的细节…"
   4. "马上就要完成啦…"

6. **中央**:阶段一放静态瓶子占位(阶段二再可交互)。

### 阶段二:互动小游戏 + 完成转场

1. **PolishGame(指甲油瓶填色)**:
   - 点击/长按瓶子 → 瓶身**摇晃**动画 + 瓶内颜色**逐格/逐段填充**上升。
   - 填满 → 瓶子叠加**轻微高光呼吸**动画 → 清空 → **换下一个颜色**继续,循环(颜色序列如 粉→裸→红→紫→…)。
   - 纯前端 state 驱动,不依赖网络;动画走 CSS transform/opacity,保证不掉帧。
   - 半联动:填色由点击驱动,与真实进度**独立**;进度条按阶段一曲线自行推进。

2. **完成转场**:`done` 为真 → 进度跳 100% → 短暂停顿 → fade + 缩放转场(0.5-0.8s,复用 `studioPopupIn` 风格)→ 回调 `onTransitionEnd`,父组件切 `ResultScreen`。

## 父组件接线(CollageHousePanel.tsx)

- 现状:`genState.phase === 'loading'` 时 `createPortal(<LoadingScreen/>, shellEl)`。
- 改为:渲染 `<NailLoadingScreen done={genState.phase==='done'} onTransitionEnd={...}/>`。
- `handleGenerate` 里 fetch 成功后仍 `setGenState({phase:'done', imageBase64})`,但结果页的切换改由 `NailLoadingScreen` 的 `onTransitionEnd` 触发(保证转场动画播完),避免生硬跳转。
- 删除旧的内联 `LoadingScreen` 函数及其 `.collage-loading-*` 样式(如未被别处引用)。

## 性能与无障碍

- 所有动画仅用 `transform` / `opacity` / `background-position`,避免 repaint/reflow。
- 进度条用单个 `requestAnimationFrame` 循环,完成或卸载时 `cancelAnimationFrame` 清理。
- `prefers-reduced-motion`:降级为静态背景 + 无浮动(保留进度与文案)。
- 加载容器保留 `aria-label` / `aria-live="polite"`(沿用现有 `.collage-loading-screen` 的无障碍属性)。
- 印花层 `aria-hidden="true"`。

## 非目标(YAGNI)

- 不做计分/排行榜。
- 不做粒子特效彩蛋。
- 进度条不与真实进度精确对应。
- 加载界面文案硬编码中文(与 CollageHousePanel 整体一致,该组件未接入 i18n)。
