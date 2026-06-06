import type { CSSProperties } from 'react';

import styles from './LandingPage.module.css';
import { journeyRows } from './landing-content';

const JOURNEY_SUFFIX = '旅程';

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
        {journeyRows.map((row) => {
          const titleLines = row.title.endsWith(JOURNEY_SUFFIX)
            ? [row.title.slice(0, -JOURNEY_SUFFIX.length), JOURNEY_SUFFIX]
            : [row.title];

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
                  {row.items.map((item, index) => (
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
                  {row.items.map((item) => (
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
