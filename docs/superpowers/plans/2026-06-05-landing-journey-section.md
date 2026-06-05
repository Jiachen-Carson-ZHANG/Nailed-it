# Landing Journey Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new landing-page journey section between the solution and why-it-works sections, with a desktop layout that closely matches the provided screenshot and a stacked mobile layout.

**Architecture:** The feature will use one new presentational component, `JourneySection`, backed by structured content in `landing-content.ts` and styled inside `LandingPage.module.css`. The component will render two themed rows from shared data, use CSS-only hover emphasis for cards and nodes, and keep motion light with reduced-motion fallbacks.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules

---

### Task 1: Add structured journey content

**Files:**
- Modify: `src/components/landing/landing-content.ts`

- [ ] **Step 1: Add the journey content export**

```ts
export const journeyRows = [
  {
    key: 'merchant',
    title: '商家\n旅程',
    theme: 'merchant',
    items: [
      {
        title: '设置价格',
        description:
          '不同甲型、延长、建构、手绘、贴钻、猫眼、渐变等项目，都可以配置对应价格和制作时长，保存后用于 AI 报价。'
      },
      {
        title: '管理日历',
        description:
          '商家可以查看每个预约对应的用户、款式、时间和美甲师，减少排班冲突和等待。'
      },
      {
        title: '联系客户',
        description:
          '商家可以查看预约详情以沟通具体细节或者调整报价，系统也可以在预约时间之前自动提醒用户准时到达。'
      },
      {
        title: '建立图册',
        description:
          '订单完成后，系统提示商家上传完成图，AI 自动识别款式特征、分类打标后沉淀为图册，方便后续展示、复用，并在用户主页展示。'
      }
    ]
  },
  {
    key: 'user',
    title: '用户\n旅程',
    theme: 'user',
    items: [
      {
        title: '选择款式',
        description:
          '用户可以在主页浏览热门美甲款式，看到喜欢的款式，可以直接加入款式购物车，也可以上传自己喜欢的款式。'
      },
      {
        title: '一键试戴',
        description:
          '款式详情页点击试戴功能，可以快速查看款式上手效果，直观看到哪一款更适合自己的手型和风格。'
      },
      {
        title: '智能报价',
        description:
          'AI 会自动拆解美甲图片，识别甲型、长度、款式等元素，根据商家的设置，智能生成预估价格和制作时间。'
      },
      {
        title: '立即预约',
        description:
          '用户确认款式后，可以直接查看可预约时段，快速完成下单，减少反复沟通和等待。'
      }
    ]
  }
] as const;
```

- [ ] **Step 2: Verify the export stays type-safe**

Run: `sed -n '1,260p' src/components/landing/landing-content.ts`
Expected: `journeyRows` is exported with `as const`, and the existing `problemCards`, `featureTabs`, and `whyItWorksLines` exports remain unchanged.

- [ ] **Step 3: Commit the content change**

```bash
git add src/components/landing/landing-content.ts
git commit -m "feat: add landing journey content"
```

### Task 2: Render the new journey section in the landing page

**Files:**
- Create: `src/components/landing/JourneySection.tsx`
- Modify: `src/components/landing/LandingPage.tsx`
- Modify: `src/components/landing/landing-content.ts`

- [ ] **Step 1: Create the journey section component**

```tsx
import styles from './LandingPage.module.css';
import { journeyRows } from './landing-content';

export function JourneySection() {
  return (
    <section
      aria-labelledby="journey-section-heading"
      className={styles.journeySection}
    >
      <h2
        id="journey-section-heading"
        className={styles.hiddenHeading}
      >
        Journey
      </h2>
      <div className={styles.journeyStack}>
        {journeyRows.map((row) => (
          <section
            key={row.key}
            aria-labelledby={`journey-row-${row.key}`}
            className={styles.journeyRow}
            data-theme={row.theme}
          >
            <div className={styles.journeyTitleBlock}>
              <h3
                id={`journey-row-${row.key}`}
                className={styles.journeyTitle}
              >
                {row.title}
              </h3>
            </div>
            <div className={styles.journeyRail}>
              <div className={styles.journeyCards}>
                {row.items.map((item, index) => (
                  <article
                    key={item.title}
                    className={styles.journeyCard}
                    style={{ ['--journey-index' as string]: index } as React.CSSProperties}
                  >
                    <h4 className={styles.journeyCardTitle}>{item.title}</h4>
                    <p className={styles.journeyCardCopy}>{item.description}</p>
                  </article>
                ))}
              </div>
              <div
                aria-hidden="true"
                className={styles.journeyTimeline}
              >
                {row.items.map((item) => (
                  <span
                    key={item.title}
                    className={styles.journeyNode}
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Insert the section into the landing page**

```tsx
import { JourneySection } from './JourneySection';
```

```tsx
      <SolutionSection />
      <JourneySection />
      <WhyItWorksSection />
```

- [ ] **Step 3: Verify the component wiring**

Run: `sed -n '1,220p' src/components/landing/JourneySection.tsx && sed -n '1,120p' src/components/landing/LandingPage.tsx`
Expected: `JourneySection` reads from `journeyRows`, uses semantic headings, and appears between `SolutionSection` and `WhyItWorksSection`.

- [ ] **Step 4: Commit the component integration**

```bash
git add src/components/landing/JourneySection.tsx src/components/landing/LandingPage.tsx
git commit -m "feat: add landing journey section"
```

### Task 3: Add high-fidelity section styling and verify behavior

**Files:**
- Modify: `src/components/landing/LandingPage.module.css`
- Test: `src/components/landing/JourneySection.tsx`

- [ ] **Step 1: Add desktop journey layout styles**

```css
.journeySection {
  display: grid;
}

.journeyStack {
  display: grid;
}

.journeyRow {
  display: grid;
  grid-template-columns: minmax(15rem, 19.5rem) minmax(0, 1fr);
  align-items: stretch;
}

.journeyRow[data-theme='merchant'] {
  background: #a8d8ea;
}

.journeyRow[data-theme='user'] {
  background: #f2aebb;
}

.journeyTitleBlock {
  display: grid;
  place-items: center;
  min-height: 27.5rem;
  border-radius: 0 2.8rem 2.8rem 0;
  margin: 1.5rem 0;
}

.journeyRow[data-theme='merchant'] .journeyTitleBlock {
  background: #5f739b;
}

.journeyRow[data-theme='user'] .journeyTitleBlock {
  background: #d6c5e4;
}

.journeyTitle {
  margin: 0;
  color: #ffffff;
  font-size: clamp(3.8rem, 6.5vw, 5.4rem);
  line-height: 1.12;
  font-weight: 800;
  white-space: pre-line;
}

.journeyRow[data-theme='user'] .journeyTitle {
  color: #1f1b1d;
}

.journeyRail {
  display: grid;
  align-content: center;
  gap: 2rem;
  padding: 3.5rem 4rem 3rem 3rem;
}

.journeyCards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.5rem;
}
```

- [ ] **Step 2: Add card, timeline, motion, and responsive styles**

```css
.journeyCard {
  min-height: 14rem;
  padding: 1.4rem 1.25rem 1rem;
  border-radius: 2rem;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 0.9rem 2rem rgba(87, 106, 143, 0.08);
  transform: translateY(0) scale(1);
  opacity: 0;
  animation: hero-enter 320ms ease-out both;
  animation-delay: calc(var(--journey-index, 0) * 70ms);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.journeyCard:hover {
  transform: translateY(-0.3rem) scale(1.03);
  box-shadow: 0 1.2rem 2.6rem rgba(87, 106, 143, 0.16);
}

.journeyCardTitle {
  margin: 0 0 1rem;
  color: var(--landing-deep);
  text-align: center;
  font-size: clamp(1.7rem, 2vw, 2.2rem);
  line-height: 1.2;
  font-weight: 800;
}

.journeyCardCopy {
  margin: 0;
  color: #202020;
  text-align: center;
  font-size: clamp(1rem, 1.28vw, 1.2rem);
  line-height: 1.58;
}

.journeyTimeline {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 1.5rem;
}

.journeyTimeline::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 0.22rem;
  background: rgba(95, 115, 155, 0.9);
  transform: translateY(-50%);
}

.journeyRow[data-theme='user'] .journeyTimeline::before {
  background: rgba(214, 197, 228, 0.98);
}

.journeyNode {
  position: relative;
  z-index: 1;
  justify-self: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 999px;
  background: #5f739b;
  transition:
    transform 180ms ease,
    filter 180ms ease;
}

.journeyRow[data-theme='user'] .journeyNode {
  background: #d6c5e4;
}

.journeyCard:hover ~ .journeyTimeline .journeyNode {
  transform: scale(1);
}

@media (max-width: 1024px) {
  .journeyRow {
    grid-template-columns: 1fr;
  }

  .journeyTitleBlock {
    min-height: auto;
    margin: 0;
    border-radius: 0 0 2.2rem 2.2rem;
    padding: 2rem 1.5rem;
  }

  .journeyRail {
    padding: 2rem 1.5rem 2.5rem;
  }

  .journeyCards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 800px) {
  .journeyCards,
  .journeyTimeline {
    grid-template-columns: 1fr;
  }

  .journeyTimeline::before {
    left: 50%;
    right: auto;
    top: 0;
    bottom: 0;
    width: 0.22rem;
    height: auto;
    transform: translateX(-50%);
  }

  .journeyCard {
    min-height: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .journeyCard,
  .journeyNode {
    animation: none;
    transition: none;
  }
}
```

- [ ] **Step 3: Run lint or targeted verification**

Run: `npm run lint`
Expected: the landing files compile cleanly without TypeScript or CSS module errors.

- [ ] **Step 4: Run a final diff check**

Run: `git diff -- src/components/landing/LandingPage.tsx src/components/landing/JourneySection.tsx src/components/landing/LandingPage.module.css src/components/landing/landing-content.ts`
Expected: the diff only contains the new journey content, new component, insertion point, and matching styles.

- [ ] **Step 5: Commit the styling and verification changes**

```bash
git add src/components/landing/LandingPage.module.css src/components/landing/JourneySection.tsx src/components/landing/LandingPage.tsx src/components/landing/landing-content.ts
git commit -m "feat: style landing journey section"
```
