'use client';

import { useId, useState } from 'react';

import { featureTabs } from './landing-content';
import { PhoneMockup } from './PhoneMockup';

const defaultFeatureKey = 'recognition';

export function SolutionSection() {
  const [activeKey, setActiveKey] = useState<(typeof featureTabs)[number]['key']>(defaultFeatureKey);
  const tabsId = useId();
  const activeFeature = featureTabs.find((feature) => feature.key === activeKey) ?? featureTabs[0];

  return (
    <section aria-label="Solution">
      <div>
        <h2>Solution</h2>
        <PhoneMockup />
      </div>
      <div aria-label="Solution features" role="tablist">
        {featureTabs.map((feature) => {
          const tabId = `${tabsId}-tab-${feature.key}`;
          const currentPanelId = `${tabsId}-panel-${feature.key}`;
          const isActive = feature.key === activeFeature.key;

          return (
            <button
              key={feature.key}
              aria-controls={currentPanelId}
              aria-selected={isActive}
              id={tabId}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
              onClick={() => setActiveKey(feature.key)}
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
