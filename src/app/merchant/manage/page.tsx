'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { useLanguage } from '@/i18n/context';
import { formatDuration } from '@/i18n/format';
import {
  glossaryById,
  basicServiceProcedures,
  billableVisualAttributes,
} from '@/data/glossary';
import { getDefaultSettings } from '@/data/glossary-settings-store';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import type { MerchantPricingSetting } from '@/domain/merchant';
import {
  listMerchantPricingSettingsAction,
  saveMerchantPricingSettingsAction,
} from '@/lib/actions/merchant-pricing-actions';
import { mergeMerchantPricingIntoDefaults } from '@/features/merchant/merge-merchant-pricing-settings';
import { ManageServiceRow } from '@/features/merchant/ManageServiceRow';
import { DISPLAY_CURRENCY, type Currency } from '@/data/currency-store';

const manageCopy = {
  'zh-CN': {
    panels: {
      basic: '基础服务',
      removal: '卸甲',
      extension: '建构/延长',
      effects: '款式效果',
      preview: '确认预览',
    },
    artGroups: ['法式', '手绘', '线条 / 图案 / 立体'],
    decoGroups: ['贴纸', '贴钻', '饰品', '箔片', '蹭粉'],
    effectsSections: {
      color: '颜色效果',
      art: '艺术效果',
      deco: '装饰效果',
    },
    previewExtra: '视觉效果附加费（可选）',
    basicTitle: '基础服务',
    basicHelper: '设置基础护理各工序的价格及所需时间。',
    modulePrice: '基础护理服务',
    processDuration: '工序时长',
    totalDuration: '总时长',
    removalTitle: '卸甲服务',
    extensionTitle: '建构 / 延长',
    extensionService: '延长服务',
    builderService: '建构服务',
    effectsTitle: '款式效果',
    previewTitle: '确认预览',
    previewHelper: '确认各项目定价后点击保存。',
    tableColumns: { item: '项目', duration: '时长', price: '单价' },
    save: '保存价格表',
    saved: '已保存',
    saveSuccess: '价格表已更新，将用于用户端 AI 报价。',
    saveError: '保存失败，请重试。',
    nav: '设置导航',
    currency: '货币单位',
    unitBasicPrice: '基础护理服务 单价',
    unitBasicPricing: '基础护理服务 单位',
    zhName: (entry: { name_zh: string; name_en: string }) => entry.name_zh,
    noValue: '—',
  },
  en: {
    panels: {
      basic: 'Basic services',
      removal: 'Removal',
      extension: 'Builder and extension',
      effects: 'Styles and effects',
      preview: 'Preview and confirm',
    },
    artGroups: ['French', 'Hand-painted', 'Lines / patterns / 3D'],
    decoGroups: ['Stickers', 'Rhinestones', 'Charms', 'Foil', 'Powders'],
    effectsSections: {
      color: 'Color effects',
      art: 'Art details',
      deco: 'Decorations',
    },
    previewExtra: 'Optional visual surcharges',
    basicTitle: 'Basic services',
    basicHelper: 'Set pricing and timing for each basic manicure step.',
    modulePrice: 'Basic manicure service',
    processDuration: 'Procedure timing',
    totalDuration: 'Total duration',
    removalTitle: 'Removal services',
    extensionTitle: 'Builder and extension',
    extensionService: 'Extension services',
    builderService: 'Builder services',
    effectsTitle: 'Styles and effects',
    previewTitle: 'Preview and confirm',
    previewHelper: 'Review the pricing summary before saving.',
    tableColumns: { item: 'Item', duration: 'Duration', price: 'Price' },
    save: 'Save pricing',
    saved: 'Saved',
    saveSuccess: 'Pricing updated and ready for customer-facing AI quotes.',
    saveError: 'Save failed. Please try again.',
    nav: 'Settings navigation',
    currency: 'Currency unit',
    unitBasicPrice: 'Basic manicure service price',
    unitBasicPricing: 'Basic manicure service unit',
    zhName: (entry: { name_zh: string; name_en: string }) => entry.name_en,
    noValue: '—',
  },
} as const;

// ── Panel IDs ──────────────────────────────────────────────────────────────────
type PanelId = 'basic' | 'removal' | 'extension' | 'effects' | 'preview';

// ── Static item lists ──────────────────────────────────────────────────────────
const REMOVAL_IDS = ['removal_basic_gel', 'removal_short_extension', 'removal_extension', 'removal_with_rhinestone'];
const EXTENSION_IDS = ['nail_tip_full_cover', 'nail_tip_half_cover', 'nail_tip_shallow_cover'];
const BUILDER_IDS = ['builder_gel'];

const COLOR_IDS = ['color_split', 'solid_color', 'gradient', 'aura_blush', 'ink_wash', 'jelly_translucent', 'cat_eye', 'glitter', 'matte_top', 'magnetic_special_effect'];

const ART_GROUP_IDS = [
  ['french_tip_basic', 'french_tip_special'],
  ['hand_paint_simple', 'hand_paint_medium', 'hand_paint_complex'],
  ['line_art', 'pattern_art', '3d_art'],
] as const;

const DECO_GROUP_IDS = [
  ['sticker'],
  ['rhinestone_small', 'rhinestone_large', 'rhinestone_heavy'],
  ['pearl', 'metal_charm', 'bow_charm', 'chain_charm', 'shell_piece'],
  ['foil_piece'],
  ['chrome_powder', 'aurora_powder', 'pearl_powder'],
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────
function useSetting(
  settingsById: Map<string, GlossaryEntrySettings>,
  id: string
): GlossaryEntrySettings | undefined {
  return settingsById.get(id);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AccordionSection({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="manage-accordion">
      <button type="button" className="manage-accordion-header" onClick={onToggle}>
        <span>{label}</span>
        <span className="manage-accordion-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="manage-accordion-body">{children}</div>}
    </div>
  );
}

function SubGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="manage-subgroup">
      <p className="manage-subgroup-label">{label}</p>
      {children}
    </div>
  );
}

// ── Panel: 基础服务 ───────────────────────────────────────────────────────────
function BasicPanel({
  settingsById,
  onChange,
  currency,
  language,
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  onChange: (s: GlossaryEntrySettings) => void;
  currency: Currency;
  language: 'zh-CN' | 'en';
}) {
  const copy = manageCopy[language];
  const moduleEntry = glossaryById.get('basic_manicure_service');
  const moduleSetting = useSetting(settingsById, 'basic_manicure_service');

  const totalDuration = useMemo(
    () => basicServiceProcedures.reduce((sum, p) => {
      const s = settingsById.get(p.id);
      return sum + (s?.duration ?? p.default_duration_min);
    }, 0),
    [settingsById]
  );

  return (
    <div className="manage-panel-content">
      <h2 className="manage-panel-title">{copy.basicTitle}</h2>
      <p className="helper-copy">{copy.basicHelper}</p>

      {moduleEntry && moduleSetting && (
        <div className="manage-module-price">
          <span className="manage-module-label">{copy.zhName(moduleEntry)}</span>
          <label className="manage-row-field">
            <span>{currency}</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={moduleSetting.price}
              onChange={(e) => onChange({ ...moduleSetting, price: Math.max(0, Number(e.target.value) || 0) })}
              aria-label={copy.unitBasicPrice}
            />
          </label>
          <select
            className="manage-row-unit"
            value={moduleSetting.unit ?? 'per_set'}
            onChange={(e) => onChange({ ...moduleSetting, unit: e.target.value })}
            aria-label={copy.unitBasicPricing}
          >
            <option value="per_set">{language === 'zh-CN' ? '套' : 'set'}</option>
            <option value="per_finger">{language === 'zh-CN' ? '每指' : 'per finger'}</option>
          </select>
        </div>
      )}

      <div className="manage-section-heading">{copy.processDuration}</div>
      {basicServiceProcedures.map((proc) => {
        const s = settingsById.get(proc.id);
        if (!s) return null;
        return (
          <ManageServiceRow
            key={proc.id}
            entry={proc}
            settings={s}
            onChange={onChange}
            showPrice={false}
            showUnit={false}
            currency={currency}
          />
        );
      })}

      <div className="manage-total-duration">
        {copy.totalDuration}：<strong>{formatDuration({ minutes: totalDuration, language })}</strong>
      </div>
    </div>
  );
}

// ── Panel: 卸甲服务 ───────────────────────────────────────────────────────────
function RemovalPanel({
  settingsById,
  onChange,
  currency,
  language,
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  onChange: (s: GlossaryEntrySettings) => void;
  currency: Currency;
  language: 'zh-CN' | 'en';
}) {
  const copy = manageCopy[language];
  return (
    <div className="manage-panel-content">
      <h2 className="manage-panel-title">{copy.removalTitle}</h2>
      {REMOVAL_IDS.map((id) => {
        const entry = glossaryById.get(id);
        const s = settingsById.get(id);
        if (!entry || !s) return null;
        return <ManageServiceRow key={id} entry={entry} settings={s} onChange={onChange} currency={currency} />;
      })}
    </div>
  );
}

// ── Panel: 建构/延长 ──────────────────────────────────────────────────────────
function ExtensionPanel({
  settingsById,
  onChange,
  currency,
  language,
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  onChange: (s: GlossaryEntrySettings) => void;
  currency: Currency;
  language: 'zh-CN' | 'en';
}) {
  const copy = manageCopy[language];
  return (
    <div className="manage-panel-content">
      <h2 className="manage-panel-title">{copy.extensionTitle}</h2>
      <div className="manage-section-heading">{copy.extensionService}</div>
      {EXTENSION_IDS.map((id) => {
        const entry = glossaryById.get(id);
        const s = settingsById.get(id);
        if (!entry || !s) return null;
        return <ManageServiceRow key={id} entry={entry} settings={s} onChange={onChange} currency={currency} />;
      })}
      <div className="manage-section-heading">{copy.builderService}</div>
      {BUILDER_IDS.map((id) => {
        const entry = glossaryById.get(id);
        const s = settingsById.get(id);
        if (!entry || !s) return null;
        return <ManageServiceRow key={id} entry={entry} settings={s} onChange={onChange} currency={currency} />;
      })}
    </div>
  );
}

// ── Panel: 款式效果 ───────────────────────────────────────────────────────────
function EffectsPanel({
  settingsById,
  onChange,
  currency,
  language,
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  onChange: (s: GlossaryEntrySettings) => void;
  currency: Currency;
  language: 'zh-CN' | 'en';
}) {
  const copy = manageCopy[language];
  const [openSection, setOpenSection] = useState<'color' | 'art' | 'deco' | null>('color');

  function toggle(section: 'color' | 'art' | 'deco') {
    setOpenSection((prev) => (prev === section ? null : section));
  }

  return (
    <div className="manage-panel-content">
      <h2 className="manage-panel-title">{copy.effectsTitle}</h2>

      <AccordionSection label={copy.effectsSections.color} open={openSection === 'color'} onToggle={() => toggle('color')}>
        {COLOR_IDS.map((id) => {
          const entry = glossaryById.get(id);
          const s = settingsById.get(id);
          if (!entry || !s) return null;
          return <ManageServiceRow key={id} entry={entry} settings={s} onChange={onChange} currency={currency} />;
        })}
      </AccordionSection>

      <AccordionSection label={copy.effectsSections.art} open={openSection === 'art'} onToggle={() => toggle('art')}>
        {ART_GROUP_IDS.map((ids, index) => (
          <SubGroup key={copy.artGroups[index]} label={copy.artGroups[index]}>
            {ids.map((id) => {
              const entry = glossaryById.get(id);
              const s = settingsById.get(id);
              if (!entry || !s) return null;
              return <ManageServiceRow key={id} entry={entry} settings={s} onChange={onChange} currency={currency} />;
            })}
          </SubGroup>
        ))}
      </AccordionSection>

      <AccordionSection label={copy.effectsSections.deco} open={openSection === 'deco'} onToggle={() => toggle('deco')}>
        {DECO_GROUP_IDS.map((ids, index) => (
          <SubGroup key={copy.decoGroups[index]} label={copy.decoGroups[index]}>
            {ids.map((id) => {
              const entry = glossaryById.get(id);
              const s = settingsById.get(id);
              if (!entry || !s) return null;
              return <ManageServiceRow key={id} entry={entry} settings={s} onChange={onChange} currency={currency} />;
            })}
          </SubGroup>
        ))}
      </AccordionSection>
    </div>
  );
}

// ── Panel: 确认预览 ───────────────────────────────────────────────────────────
const PREVIEW_SECTIONS: { label: string; ids: string[] }[] = [
  { label: '基础服务', ids: ['basic_manicure_service'] },
  { label: '卸甲服务', ids: REMOVAL_IDS },
  { label: '建构 / 延长', ids: [...EXTENSION_IDS, ...BUILDER_IDS] },
  { label: '款式效果', ids: [...COLOR_IDS, ...ART_GROUP_IDS.flatMap((g) => g), ...DECO_GROUP_IDS.flatMap((g) => g)] },
];

const UNIT_ZH: Record<string, string> = {
  per_set:    '每套',
  per_finger: '每指',
  per_piece:  '每颗',
  fixed:      '每次',
  per_level:  '级',
  included:   '含',
  tag_only:   '每套',
};

function unitZh(unit: string): string {
  return UNIT_ZH[unit] ?? unit;
}

function PreviewPanel({
  settingsById,
  dirty,
  onSave,
  currency,
  language,
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  dirty: boolean;
  onSave: () => void;
  currency: string;
  language: 'zh-CN' | 'en';
}) {
  const copy = manageCopy[language];
  const [openSection, setOpenSection] = useState<string | null>(null);
  const optionalAttrs = billableVisualAttributes;

  // For 基础服务: total duration = sum of all procedure durations
  const basicTotalDuration = basicServiceProcedures.reduce((sum, p) => {
    const s = settingsById.get(p.id);
    return sum + (s?.duration ?? p.default_duration_min);
  }, 0);

  function renderRow(id: string) {
    const entry = glossaryById.get(id);
    const s = settingsById.get(id);
    if (!entry || !s) return null;
    const unit = unitZh(s.unit ?? entry.default_pricing_unit);
    const duration = id === 'basic_manicure_service' ? basicTotalDuration : s.duration;
    return (
      <tr key={id}>
        <td>{copy.zhName(entry)}</td>
        <td>{duration > 0 ? formatDuration({ minutes: duration, language }) : copy.noValue}</td>
        <td>{s.price > 0 ? `${s.price.toFixed(2)} ${currency} / ${unit}` : copy.noValue}</td>
      </tr>
    );
  }

  return (
    <div className="manage-panel-content">
      <h2 className="manage-panel-title">{copy.previewTitle}</h2>
      <p className="helper-copy">{copy.previewHelper}</p>

      {PREVIEW_SECTIONS.map((section) => (
        <AccordionSection
          key={section.label}
          label={
            section.label === '基础服务' ? copy.panels.basic
              : section.label === '卸甲服务' ? copy.removalTitle
              : section.label === '建构 / 延长' ? copy.extensionTitle
              : copy.effectsTitle
          }
          open={openSection === section.label}
          onToggle={() => setOpenSection((prev) => (prev === section.label ? null : section.label))}
        >
          <table className="manage-preview-table">
            <thead>
              <tr>
                <th>{copy.tableColumns.item}</th>
                <th>{copy.tableColumns.duration}</th>
                <th>{copy.tableColumns.price}</th>
              </tr>
            </thead>
            <tbody>
              {section.ids.map((id) => renderRow(id))}
            </tbody>
          </table>
        </AccordionSection>
      ))}

      {optionalAttrs.length > 0 && (
        <AccordionSection
          label={copy.previewExtra}
          open={openSection === 'optional'}
          onToggle={() => setOpenSection((prev) => (prev === 'optional' ? null : 'optional'))}
        >
          <table className="manage-preview-table">
            <thead>
              <tr>
                <th>{copy.tableColumns.item}</th>
                <th>{copy.tableColumns.duration}</th>
                <th>{copy.tableColumns.price}</th>
              </tr>
            </thead>
            <tbody>
              {optionalAttrs.map((entry) => {
                const s = settingsById.get(entry.id);
                if (!s) return null;
                const unit = unitZh(s.unit ?? entry.default_pricing_unit);
                return (
                  <tr key={entry.id}>
                    <td>{copy.zhName(entry)}</td>
                    <td>{s.duration > 0 ? formatDuration({ minutes: s.duration, language }) : copy.noValue}</td>
                    <td>{s.price > 0 ? `${s.price.toFixed(2)} ${currency} / ${unit}` : copy.noValue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AccordionSection>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <Button block onClick={onSave} disabled={!dirty}>
          {dirty ? copy.save : copy.saved}
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MerchantManagePage() {
  const { language } = useLanguage();
  const copy = manageCopy[language];
  const [settings, setSettings] = useState<GlossaryEntrySettings[]>([]);
  const [activePanel, setActivePanel] = useState<PanelId>('basic');
  const [toastMessage, setToastMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const currency = DISPLAY_CURRENCY;

  // Pricing is authoritative in the DB (merchant_pricing), not localStorage. Load the full UI entry
  // set (incl. the time-only base procedures the panels show) from defaults, then overlay the
  // merchant's saved billable price/duration from the DB so quotes and this screen agree.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const db = await listMerchantPricingSettingsAction();
        if (active) setSettings(mergeMerchantPricingIntoDefaults(db));
      } catch {
        if (active) setSettings(getDefaultSettings());
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const settingsById = useMemo(
    () => new Map<string, GlossaryEntrySettings>(settings.map((s) => [s.id, s])),
    [settings]
  );

  function updateSetting(next: GlossaryEntrySettings) {
    setSettings((current) => current.map((s) => (s.id === next.id ? next : s)));
    setDirty(true);
  }

  async function handleSave() {
    // Only billable items live in merchant_pricing; the time-only procedures (billable=false) are
    // platform defaults and are not persisted per-merchant.
    const rows: MerchantPricingSetting[] = settings
      .filter((s) => glossaryById.get(s.id)?.billable !== false)
      .flatMap((s) => {
        const entry = glossaryById.get(s.id);
        if (!entry) return [];
        const parentEntry = entry.parent_id !== 'na' ? glossaryById.get(entry.parent_id) : undefined;
        return [{
          id: s.id,
          name: entry.name,
          nameZh: entry.name_zh,
          groupLabel: parentEntry?.name_zh ?? entry.name_zh,
          groupLabelLocalized: parentEntry?.name ?? entry.name,
          price: s.price,
          duration: s.duration,
          enabled: s.enabled,
        }];
      });
    try {
      await saveMerchantPricingSettingsAction(rows);
      setToastMessage(copy.saveSuccess);
      setDirty(false);
    } catch {
      setToastMessage(copy.saveError);
    }
  }

  const panelProps = { settingsById, onChange: updateSetting, currency, language };

  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <div className="manage-layout">
        {/* ── Sidebar ── */}
        <nav className="manage-sidebar" aria-label={copy.nav}>
          {(['basic', 'removal', 'extension', 'effects', 'preview'] as const).map((panelId) => (
            <button
              key={panelId}
              type="button"
              className={`manage-sidebar-btn${activePanel === panelId ? ' manage-sidebar-btn-active' : ''}`}
              onClick={() => setActivePanel(panelId)}
            >
              {copy.panels[panelId]}
            </button>
          ))}
        </nav>

        {/* ── Main panel ── */}
        <div className="manage-main">
          {activePanel === 'basic'     && <BasicPanel {...panelProps} />}
          {activePanel === 'removal'   && <RemovalPanel {...panelProps} />}
          {activePanel === 'extension' && <ExtensionPanel {...panelProps} />}
          {activePanel === 'effects'   && <EffectsPanel {...panelProps} />}
          {activePanel === 'preview'   && (
            <PreviewPanel settingsById={settingsById} dirty={dirty} onSave={handleSave} currency={currency} language={language} />
          )}
        </div>
      </div>
      <Toast message={toastMessage} />
    </MobileLayout>
  );
}
