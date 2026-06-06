'use client';

import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import {
  listMerchantPricingSettingsAction,
  saveMerchantPricingSettingsAction,
} from '@/lib/actions/merchant-pricing-actions';
import type { MerchantPricingSetting } from '@/domain/merchant';
import { GlossaryEntryCard } from '@/features/merchant/GlossaryEntryCard';

export default function MerchantManagePage() {
  const [settings, setSettings] = useState<MerchantPricingSetting[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    listMerchantPricingSettingsAction()
      .then(setSettings)
      .catch(() => setToastMessage('价格表加载失败，请重试。'));
  }, []);

  function updateSetting(next: MerchantPricingSetting) {
    setSettings((current) => current.map((s) => (s.id === next.id ? next : s)));
    setDirty(true);
  }

  async function handleSave() {
    try {
      setSettings(await saveMerchantPricingSettingsAction(settings));
      setToastMessage('价格表已保存到数据库，将用于用户端报价。');
      setDirty(false);
    } catch {
      setToastMessage('价格表保存失败，请重试。');
    }
  }

  const settingsById = new Map<string, MerchantPricingSetting>(settings.map((s) => [s.id, s]));
  const groups = new Map<string, MerchantPricingSetting[]>();
  for (const setting of settingsById.values()) {
    groups.set(setting.groupLabel, [...(groups.get(setting.groupLabel) ?? []), setting]);
  }

  return (
    <MobileLayout
      role="merchant"
      subtitle="Pricing and team."
      title="Nailed-it"
    >
      <section className="page-heading">
        <p className="section-eyebrow">服务项目配置</p>
        <h1>设置单价与时长</h1>
      </section>

      {[...groups].map(([groupLabel, entries]) => (
        <section key={groupLabel} className="pricing-section">
          <h2>{groupLabel}</h2>
          {entries.map((setting) => (
            <GlossaryEntryCard
              key={setting.id}
              settings={setting}
              onChange={updateSetting}
            />
          ))}
        </section>
      ))}

      <div className="pricing-save-bar" data-dirty={dirty}>
        <span className="pricing-save-status">
          {dirty ? '有未保存的更改' : '全部已保存'}
        </span>
        <Button onClick={handleSave} disabled={!dirty}>
          {dirty ? '保存价格表' : '已保存'}
        </Button>
      </div>
      <Toast message={toastMessage} />
    </MobileLayout>
  );
}
