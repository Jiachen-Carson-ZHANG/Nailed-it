'use client';

import { useId, useRef, useState } from 'react';

import styles from './LandingPage.module.css';
import { LandingScreenshot } from './LandingScreenshot';
import { featureTabs } from './landing-content';

const defaultFeatureKey = 'recognition';

export function SolutionSection() {
  const [activeKey, setActiveKey] = useState<(typeof featureTabs)[number]['key']>(defaultFeatureKey);
  const tabsId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeFeature = featureTabs.find((feature) => feature.key === activeKey) ?? featureTabs[0];

  function activateTab(nextIndex: number) {
    const nextFeature = featureTabs[nextIndex];

    if (!nextFeature) {
      return;
    }

    setActiveKey(nextFeature.key);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section
      aria-label="Solution"
      className={styles.section}
    >
      <div className={`${styles.sectionContent} ${styles.solution}`}>
        <h2 className={styles.hiddenHeading}>Solution</h2>
        <div
          aria-label="Solution features"
          role="tablist"
          className={styles.solutionTabList}
        >
          {featureTabs.map((feature, featureIndex) => {
            const tabId = `${tabsId}-tab-${feature.key}`;
            const currentPanelId = `${tabsId}-panel-${feature.key}`;
            const isActive = feature.key === activeFeature.key;

            return (
              <button
                key={feature.key}
                aria-controls={currentPanelId}
                aria-selected={isActive}
                data-variant={feature.key}
                id={tabId}
                ref={(element) => {
                  tabRefs.current[featureIndex] = element;
                }}
                className={styles.solutionTab}
                role="tab"
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => setActiveKey(feature.key)}
                onKeyDown={(event) => {
                  switch (event.key) {
                    case 'ArrowRight':
                    case 'ArrowDown':
                      event.preventDefault();
                      activateTab((featureIndex + 1) % featureTabs.length);
                      break;
                    case 'ArrowLeft':
                    case 'ArrowUp':
                      event.preventDefault();
                      activateTab((featureIndex - 1 + featureTabs.length) % featureTabs.length);
                      break;
                    case 'Home':
                      event.preventDefault();
                      activateTab(0);
                      break;
                    case 'End':
                      event.preventDefault();
                      activateTab(featureTabs.length - 1);
                      break;
                    default:
                      break;
                  }
                }}
              >
                {feature.tabLabel}
              </button>
            );
          })}
        </div>
        <div className={styles.solutionBody}>
          <div className={styles.solutionVisual}>
            <LandingScreenshot
              alt={activeFeature.screenshot.alt}
              src={activeFeature.screenshot.src}
              variant="solution"
            />
          </div>
          <div className={styles.solutionPanelArea}>
            {featureTabs.map((feature) => {
              const tabId = `${tabsId}-tab-${feature.key}`;
              const panelId = `${tabsId}-panel-${feature.key}`;
              const isActive = feature.key === activeFeature.key;

              return (
                <div
                  key={feature.key}
                  aria-labelledby={tabId}
                  className={styles.solutionPanel}
                  data-variant={feature.key}
                  hidden={!isActive}
                  id={panelId}
                  role="tabpanel"
                >
                  <h3 className={styles.solutionHeading}>{feature.title}</h3>
                  <p className={styles.solutionSubtitle}>{feature.subtitle}</p>
                  <div className={styles.solutionCopy}>
                    {feature.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
