'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import styles from './LandingPage.module.css';
import { journeyRows } from './landing-content';

const JOURNEY_ROW_COUNT = 2;
const JOURNEY_STEP_COUNT = 4;
const JOURNEY_SUFFIX = '旅程';

function splitJourneyTitle(title: string) {
  if (!title.endsWith(JOURNEY_SUFFIX)) {
    return [title];
  }

  return [title.slice(0, -JOURNEY_SUFFIX.length), JOURNEY_SUFFIX];
}

type JourneyRowSectionProps = {
  row: (typeof journeyRows)[number];
};

function JourneyRowSection({ row }: JourneyRowSectionProps) {
  const rowRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const rowElement = rowRef.current;

    if (!rowElement) {
      return;
    }

    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIsVisible(true);
      return;
    }

    if (typeof IntersectionObserver !== 'function') {
      // 中文注释：测试环境或低能力环境下直接展示内容，避免 reveal 逻辑阻塞渲染。
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        setIsVisible(entry.isIntersecting);
      },
      {
        threshold: 0.38
      }
    );

    observer.observe(rowElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  const visibleItems = row.items.slice(0, JOURNEY_STEP_COUNT);
  const titleLines = splitJourneyTitle(row.title);

  return (
    <section
      ref={rowRef}
      aria-labelledby={`journey-row-${row.key}`}
      className={styles.journeyRow}
      data-theme={row.theme}
      data-visible={isVisible}
    >
      <div className={styles.journeyTitleBlock}>
        <h3
          id={`journey-row-${row.key}`}
          className={styles.journeyTitle}
        >
          {titleLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </h3>
      </div>
      <div className={styles.journeyRail}>
        <ol className={styles.journeyCards}>
          {visibleItems.map((item, index) => (
            <li
              key={item.title}
              className={styles.journeyCard}
              style={{ ['--journey-index' as string]: index } as CSSProperties}
            >
              <article>
                <h4 className={styles.journeyCardTitle}>{item.title}</h4>
                <p className={styles.journeyCardCopy}>{item.description}</p>
              </article>
            </li>
          ))}
        </ol>
        <div
          aria-hidden="true"
          className={styles.journeyTimeline}
        >
          {visibleItems.map((item, index) => (
            <span
              key={item.title}
              className={styles.journeyNode}
              style={{ ['--journey-index' as string]: index } as CSSProperties}
            />
          ))}
        </div>
        <div
          aria-hidden="true"
          className={styles.journeyScreenshotRow}
        >
          {visibleItems.map((item, index) => (
            <div
              key={item.title}
              className={styles.journeyScreenshotSlot}
              style={{ ['--journey-index' as string]: index } as CSSProperties}
            >
              <div className={styles.journeyScreenshotFrame}>
                <div className={styles.journeyScreenshotNotch} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function JourneySection() {
  return (
    <section
      aria-labelledby="journey-section-heading"
      className={`${styles.section} ${styles.journeySection}`}
    >
      <h2
        id="journey-section-heading"
        className={styles.hiddenHeading}
      >
        Journey
      </h2>
      <div className={styles.journeyStack}>
        {journeyRows.slice(0, JOURNEY_ROW_COUNT).map((row) => (
          <JourneyRowSection
            key={row.key}
            row={row}
          />
        ))}
      </div>
    </section>
  );
}
