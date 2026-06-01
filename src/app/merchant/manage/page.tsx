'use client';

import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import type { PricingCategory, PricingItem } from '@/domain/nail';
import { pricingTargetLabels } from '@/domain/nail';
import { PricingRuleCard } from '@/features/merchant/PricingRuleCard';
import { defaultPricingRules } from '@/mock/pricing';

const categoryLabels: Record<PricingCategory, string> = {
  base: 'Base services',
  shape: 'Nail shapes',
  style: 'Style types',
  addon: 'Add-ons'
};

const orderedCategories: PricingCategory[] = ['base', 'shape', 'style', 'addon'];

export default function MerchantManagePage() {
  const [rules, setRules] = useState(defaultPricingRules);
  const [toastMessage, setToastMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  function updateRule(nextRule: PricingItem) {
    setRules((currentRules) =>
      currentRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
    );
    setDirty(true);
  }

  function saveRules() {
    setToastMessage('Price list updated for customer estimates.');
    setDirty(false);
  }

  return (
    <MobileLayout
      role="merchant"
      subtitle="Pricing and team."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Price list</p>
        <h1>Configure estimate rules</h1>
      </section>

      {orderedCategories.map((category) => (
        <section key={category} className="pricing-section">
          <h2>{categoryLabels[category]}</h2>
          {rules
            .filter((rule) => rule.category === category)
            .map((rule) => (
              <PricingRuleCard
                key={rule.id}
                item={rule}
                label={pricingTargetLabels[rule.target]}
                onChange={updateRule}
              />
            ))}
        </section>
      ))}

      <div className="pricing-save-bar" data-dirty={dirty}>
        <span className="pricing-save-status">
          {dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>
        <Button onClick={saveRules} disabled={!dirty}>
          {dirty ? 'Save price list' : 'Saved'}
        </Button>
      </div>
      <Toast message={toastMessage} />
    </MobileLayout>
  );
}
