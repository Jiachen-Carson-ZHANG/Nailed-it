'use client';

import { useId, useRef, useState } from 'react';

import { featureTabs } from './landing-content';
import { PhoneMockup } from './PhoneMockup';

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
    <section aria-label="Solution">
      <div>
        <h2>Solution</h2>
        <PhoneMockup />
      </div>
      <div aria-label="Solution features" role="tablist">
        {featureTabs.map((feature, featureIndex) => {
          const tabId = `${tabsId}-tab-${feature.key}`;
          const currentPanelId = `${tabsId}-panel-${feature.key}`;
          const isActive = feature.key === activeFeature.key;

          return (
            <button
              key={feature.key}
              aria-controls={currentPanelId}
              aria-selected={isActive}
              id={tabId}
              ref={(element) => {
                tabRefs.current[featureIndex] = element;
              }}
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
      {featureTabs.map((feature) => {
        const tabId = `${tabsId}-tab-${feature.key}`;
        const panelId = `${tabsId}-panel-${feature.key}`;
        const isActive = feature.key === activeFeature.key;

        return (
          <div
            key={feature.key}
            aria-labelledby={tabId}
            hidden={!isActive}
            id={panelId}
            role="tabpanel"
          >
            <h3>{feature.title}</h3>
            <p>{feature.subtitle}</p>
            {feature.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        );
      })}
    </section>
  );
}
