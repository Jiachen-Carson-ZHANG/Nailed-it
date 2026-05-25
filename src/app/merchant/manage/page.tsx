'use client';

import { useState } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import type { PricingCategory, PricingItem } from '@/domain/nail';
import { PricingRuleCard } from '@/features/merchant/PricingRuleCard';
import { TechnicianRosterCard } from '@/features/merchant/TechnicianRosterCard';
import { getBookingsSnapshot } from '@/mock/operations-store';
import { defaultPricingRules } from '@/mock/pricing';
import { mockTechnicians } from '@/mock/technicians';

const categoryLabels: Record<PricingCategory, string> = {
  base: 'Base services',
  shape: 'Nail shapes',
  style: 'Style types',
  addon: 'Add-ons'
};

const targetLabels: Record<PricingItem['target'], string> = {
  removal: 'Removal',
  extension: 'Extension',
  builderGel: 'Builder gel',
  round: 'Round',
  square: 'Square',
  squoval: 'Squoval',
  oval: 'Oval',
  almond: 'Almond',
  coffin: 'Coffin',
  stiletto: 'Stiletto',
  solid: 'Solid',
  french: 'French',
  catEye: 'Cat eye',
  chrome: 'Chrome',
  rhinestone: 'Rhinestone',
  charms: 'Charms',
  glitter: 'Glitter'
};

const orderedCategories: PricingCategory[] = ['base', 'shape', 'style', 'addon'];

export default function MerchantManagePage() {
  const [bookings] = useState(() => getBookingsSnapshot());
  const [rules, setRules] = useState(defaultPricingRules);
  const [toastMessage, setToastMessage] = useState('');

  function updateRule(nextRule: PricingItem) {
    setRules((currentRules) =>
      currentRules.map((rule) => (rule.id === nextRule.id ? nextRule : rule))
    );
  }

  return (
    <MobileLayout
      role="merchant"
      subtitle="Tune the shared pricing rules that feed both customer estimates and merchant booking snapshots."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">Price list</p>
        <h1>Configure estimate rules</h1>
      </section>

      <TechnicianRosterCard
        bookings={bookings}
        description="Keep staff visibility beside pricing so quotation rules and actual capacity stay aligned."
        technicians={mockTechnicians}
        title="Technician roster"
      />

      {orderedCategories.map((category) => (
        <section key={category} className="pricing-section">
          <h2>{categoryLabels[category]}</h2>
          {rules
            .filter((rule) => rule.category === category)
            .map((rule) => (
              <PricingRuleCard
                key={rule.id}
                item={rule}
                label={targetLabels[rule.target]}
                onChange={updateRule}
              />
            ))}
        </section>
      ))}

      <Button onClick={() => setToastMessage('Price list updated for customer estimates.')}>
        Save price list
      </Button>
      <Toast message={toastMessage} />
    </MobileLayout>
  );
}
