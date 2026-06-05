'use client';

import { useState, useEffect } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { billableComponents, glossaryById, serviceModules } from '@/data/glossary';
import {
  loadGlossarySettings,
  saveGlossarySettings
} from '@/data/glossary-settings-store';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import { GlossaryEntryCard } from '@/features/merchant/GlossaryEntryCard';

// Group billable components by their parent service_module id
const componentsByModule: { moduleId: string; entries: typeof billableComponents }[] = serviceModules
  .map((mod) => ({
    moduleId: mod.id,
    entries: billableComponents.filter((e) => e.parent_id === mod.id)
  }))
  .filter((group) => group.entries.length > 0);

export default function MerchantManagePage() {
  const [settings, setSettings] = useState<GlossaryEntrySettings[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSettings(loadGlossarySettings());
  }, []);

  function updateSetting(next: GlossaryEntrySettings) {
    setSettings((current) => current.map((s) => (s.id === next.id ? next : s)));
    setDirty(true);
  }

  function handleSave() {
    saveGlossarySettings(settings);
    setToastMessage('价格表已更新，将用于用户端 AI 报价。');
    setDirty(false);
  }

  const settingsById = new Map<string, GlossaryEntrySettings>(settings.map((s) => [s.id, s]));

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

      {componentsByModule.map(({ moduleId, entries }) => {
        const module = glossaryById.get(moduleId);
        if (!module) return null;
        return (
          <section key={moduleId} className="pricing-section">
            <h2>{module.name_zh}</h2>
            {entries.map((entry) => {
              const s = settingsById.get(entry.id);
              if (!s) return null;
              return (
                <GlossaryEntryCard
                  key={entry.id}
                  entry={entry}
                  settings={s}
                  onChange={updateSetting}
                />
              );
            })}
          </section>
        );
      })}

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
