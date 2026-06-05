import type { CSSProperties } from 'react';

import styles from './LandingPage.module.css';
import { journeyRows } from './landing-content';

const JOURNEY_ROW_COUNT = 2;
const JOURNEY_STEP_COUNT = 4;

function splitJourneyTitle(title: string) {
  const suffix = '旅程';

  if (!title.endsWith(suffix)) {
    return [title];
  }

  return [title.slice(0, -suffix.length), suffix];
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
        {journeyRows.slice(0, JOURNEY_ROW_COUNT).map((row) => {
          const visibleItems = row.items.slice(0, JOURNEY_STEP_COUNT);
          const titleLines = splitJourneyTitle(row.title);

          return (
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
                  {visibleItems.map((item) => (
                    <span
                      key={item.title}
                      className={styles.journeyNode}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
