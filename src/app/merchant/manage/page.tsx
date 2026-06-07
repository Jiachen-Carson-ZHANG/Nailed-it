'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
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
import { ManageServiceRow } from '@/features/merchant/ManageServiceRow';
import {
  loadCurrency,
  saveCurrency,
  CURRENCY_OPTIONS,
  type Currency,
} from '@/data/currency-store';

// ── Panel IDs ──────────────────────────────────────────────────────────────────
type PanelId = 'basic' | 'removal' | 'extension' | 'effects' | 'preview';

const PANELS: { id: PanelId; label: string }[] = [
  { id: 'basic',     label: '基础服务' },
  { id: 'removal',   label: '卸甲' },
  { id: 'extension', label: '建构/延长' },
  { id: 'effects',   label: '款式效果' },
  { id: 'preview',   label: '确认预览' },
];

// ── Static item lists ──────────────────────────────────────────────────────────
const REMOVAL_IDS = ['removal_basic_gel', 'removal_short_origin', 'removal_extension', 'removal_with_rhinestone'];
const EXTENSION_IDS = ['nail_tip_full_cover', 'nail_tip_half_cover', 'nail_tip_shallow_cover'];
const BUILDER_IDS = ['builder_gel'];

const COLOR_IDS = ['color_split', 'solid_color', 'dual_color', 'gradient', 'aura_blush', 'ink_wash', 'jelly_translucent', 'cat_eye', 'glitter', 'matte_top'];

const ART_GROUPS: { label: string; ids: string[] }[] = [
  { label: '法式', ids: ['french_tip_basic', 'french_tip_special'] },
  { label: '手绘', ids: ['hand_paint_simple', 'hand_paint_medium', 'hand_paint_complex'] },
  { label: '线条 / 图案 / 立体', ids: ['line_art', 'pattern_art', '3d_art'] },
];

const DECO_GROUPS: { label: string; ids: string[] }[] = [
  { label: '贴纸', ids: ['sticker'] },
  { label: '贴钻', ids: ['rhinestone_small', 'rhinestone_large', 'rhinestone_heavy'] },
  { label: '饰品', ids: ['pearl', 'metal_charm', 'bow_charm', 'chain_charm', 'shell_piece'] },
  { label: '箔片', ids: ['foil_piece'] },
  { label: '蹭粉', ids: ['chrome_powder', 'aurora_powder', 'pearl_powder'] },
];

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
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  onChange: (s: GlossaryEntrySettings) => void;
  currency: Currency;
}) {
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
      <h2 className="manage-panel-title">基础服务</h2>
      <p className="helper-copy">设置基础护理各工序的价格及所需时间。</p>

      {moduleEntry && moduleSetting && (
        <div className="manage-module-price">
          <span className="manage-module-label">{moduleEntry.name_zh}</span>
          <label className="manage-row-field">
            <span>{currency}</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={moduleSetting.price}
              onChange={(e) => onChange({ ...moduleSetting, price: Math.max(0, Number(e.target.value) || 0) })}
              aria-label="基础护理服务 单价"
            />
          </label>
          <select
            className="manage-row-unit"
            value={moduleSetting.unit ?? 'per_set'}
            onChange={(e) => onChange({ ...moduleSetting, unit: e.target.value })}
            aria-label="基础护理服务 单位"
          >
            <option value="per_set">套</option>
            <option value="per_finger">每指</option>
          </select>
        </div>
      )}

      <div className="manage-section-heading">工序时长</div>
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
        总时长：<strong>{totalDuration} 分钟</strong>
      </div>
    </div>
  );
}

// ── Panel: 卸甲服务 ───────────────────────────────────────────────────────────
function RemovalPanel({
  settingsById,
  onChange,
  currency,
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  onChange: (s: GlossaryEntrySettings) => void;
  currency: Currency;
}) {
  return (
    <div className="manage-panel-content">
      <h2 className="manage-panel-title">卸甲服务</h2>
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
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  onChange: (s: GlossaryEntrySettings) => void;
  currency: Currency;
}) {
  return (
    <div className="manage-panel-content">
      <h2 className="manage-panel-title">建构 / 延长</h2>
      <div className="manage-section-heading">延长服务</div>
      {EXTENSION_IDS.map((id) => {
        const entry = glossaryById.get(id);
        const s = settingsById.get(id);
        if (!entry || !s) return null;
        return <ManageServiceRow key={id} entry={entry} settings={s} onChange={onChange} currency={currency} />;
      })}
      <div className="manage-section-heading">建构服务</div>
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
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  onChange: (s: GlossaryEntrySettings) => void;
  currency: Currency;
}) {
  const [openSection, setOpenSection] = useState<'color' | 'art' | 'deco' | null>('color');

  function toggle(section: 'color' | 'art' | 'deco') {
    setOpenSection((prev) => (prev === section ? null : section));
  }

  return (
    <div className="manage-panel-content">
      <h2 className="manage-panel-title">款式效果</h2>

      <AccordionSection label="颜色效果" open={openSection === 'color'} onToggle={() => toggle('color')}>
        {COLOR_IDS.map((id) => {
          const entry = glossaryById.get(id);
          const s = settingsById.get(id);
          if (!entry || !s) return null;
          return <ManageServiceRow key={id} entry={entry} settings={s} onChange={onChange} currency={currency} />;
        })}
      </AccordionSection>

      <AccordionSection label="艺术效果" open={openSection === 'art'} onToggle={() => toggle('art')}>
        {ART_GROUPS.map((group) => (
          <SubGroup key={group.label} label={group.label}>
            {group.ids.map((id) => {
              const entry = glossaryById.get(id);
              const s = settingsById.get(id);
              if (!entry || !s) return null;
              return <ManageServiceRow key={id} entry={entry} settings={s} onChange={onChange} currency={currency} />;
            })}
          </SubGroup>
        ))}
      </AccordionSection>

      <AccordionSection label="装饰效果" open={openSection === 'deco'} onToggle={() => toggle('deco')}>
        {DECO_GROUPS.map((group) => (
          <SubGroup key={group.label} label={group.label}>
            {group.ids.map((id) => {
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
  { label: '款式效果', ids: [...COLOR_IDS, ...ART_GROUPS.flatMap((g) => g.ids), ...DECO_GROUPS.flatMap((g) => g.ids)] },
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
}: {
  settingsById: Map<string, GlossaryEntrySettings>;
  dirty: boolean;
  onSave: () => void;
  currency: string;
}) {
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
        <td>{entry.name_zh}</td>
        <td>{duration > 0 ? `${duration} 分钟` : '—'}</td>
        <td>{s.price > 0 ? `${s.price.toFixed(2)} ${currency} / ${unit}` : '—'}</td>
      </tr>
    );
  }

  return (
    <div className="manage-panel-content">
      <h2 className="manage-panel-title">确认预览</h2>
      <p className="helper-copy">确认各项目定价后点击保存。</p>

      {PREVIEW_SECTIONS.map((section) => (
        <AccordionSection
          key={section.label}
          label={section.label}
          open={openSection === section.label}
          onToggle={() => setOpenSection((prev) => (prev === section.label ? null : section.label))}
        >
          <table className="manage-preview-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>时长</th>
                <th>单价</th>
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
          label="视觉效果附加费（可选）"
          open={openSection === 'optional'}
          onToggle={() => setOpenSection((prev) => (prev === 'optional' ? null : 'optional'))}
        >
          <table className="manage-preview-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>时长</th>
                <th>单价</th>
              </tr>
            </thead>
            <tbody>
              {optionalAttrs.map((entry) => {
                const s = settingsById.get(entry.id);
                if (!s) return null;
                const unit = unitZh(s.unit ?? entry.default_pricing_unit);
                return (
                  <tr key={entry.id}>
                    <td>{entry.name_zh}</td>
                    <td>{s.duration > 0 ? `${s.duration} 分钟` : '—'}</td>
                    <td>{s.price > 0 ? `${s.price.toFixed(2)} ${currency} / ${unit}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AccordionSection>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <Button block onClick={onSave} disabled={!dirty}>
          {dirty ? '保存价格表' : '已保存'}
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MerchantManagePage() {
  const [settings, setSettings] = useState<GlossaryEntrySettings[]>([]);
  const [activePanel, setActivePanel] = useState<PanelId>('basic');
  const [toastMessage, setToastMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [currency, setCurrency] = useState<Currency>(() => loadCurrency());

  // Pricing is authoritative in the DB (merchant_pricing), not localStorage. Load the full UI entry
  // set (incl. the time-only base procedures the panels show) from defaults, then overlay the
  // merchant's saved billable price/duration from the DB so quotes and this screen agree.
  useEffect(() => {
    let active = true;
    (async () => {
      const base = getDefaultSettings();
      try {
        const db = await listMerchantPricingSettingsAction();
        const dbById = new Map(db.map((r) => [r.id, r]));
        const merged = base.map((s) => {
          const row = dbById.get(s.id);
          return row ? { ...s, price: row.price, duration: row.duration, enabled: row.enabled } : s;
        });
        if (active) setSettings(merged);
      } catch {
        if (active) setSettings(base);
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
      .map((s) => ({
        id: s.id,
        nameZh: glossaryById.get(s.id)?.name_zh ?? '',
        groupLabel: '',
        price: s.price,
        duration: s.duration,
        enabled: s.enabled,
      }));
    try {
      await saveMerchantPricingSettingsAction(rows);
      setToastMessage('价格表已更新，将用于用户端 AI 报价。');
      setDirty(false);
    } catch {
      setToastMessage('保存失败，请重试。');
    }
  }

  function handleCurrencyChange(c: Currency) {
    saveCurrency(c);
    setCurrency(c);
  }

  const panelProps = { settingsById, onChange: updateSetting, currency };

  return (
    <MobileLayout role="merchant" title="Nailed-it" subtitle="Pricing and team.">
      <div className="manage-layout">
        {/* ── Sidebar ── */}
        <nav className="manage-sidebar" aria-label="设置导航">
          {PANELS.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`manage-sidebar-btn${activePanel === panel.id ? ' manage-sidebar-btn-active' : ''}`}
              onClick={() => setActivePanel(panel.id)}
            >
              {panel.label}
            </button>
          ))}
          <select
            className="manage-currency-select"
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value as Currency)}
            aria-label="货币单位"
          >
            {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </nav>

        {/* ── Main panel ── */}
        <div className="manage-main">
          {activePanel === 'basic'     && <BasicPanel {...panelProps} />}
          {activePanel === 'removal'   && <RemovalPanel {...panelProps} />}
          {activePanel === 'extension' && <ExtensionPanel {...panelProps} />}
          {activePanel === 'effects'   && <EffectsPanel {...panelProps} />}
          {activePanel === 'preview'   && (
            <PreviewPanel settingsById={settingsById} dirty={dirty} onSave={handleSave} currency={currency} />
          )}
        </div>
      </div>
      <Toast message={toastMessage} />
    </MobileLayout>
  );
}
