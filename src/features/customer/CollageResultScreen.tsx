'use client';

import { useState, useCallback } from 'react';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { type DrawerZoneId, DRAWER_ZONES } from './studio-layout-config';

// 这两个类型待 Task 3 从 CollageHousePanel 导出后替换为 import
type DrawerItem = {
  id: string;
  label: string;
  emoji: string;
  category: string;
  description: string;
};

type PlacedDecal = {
  key: string;
  item: DrawerItem;
  px: number;
  py: number;
};

// DrawerItems 数据待 Task 3 从 CollageHousePanel 导出后替换为 import
type DrawerItemsMap = Record<DrawerZoneId, DrawerItem[]>;

export type CollageResultScreenProps = {
  originalImage: SelectedNailImage;
  latestImage: SelectedNailImage;
  decals: PlacedDecal[];
  extraText: string;
  drawerItems: DrawerItemsMap;
  onExtraTextChange: (text: string) => void;
  onPartialRegen: (checkedZones: DrawerZoneId[], newDecals: PlacedDecal[], newExtraText: string) => void;
  onFullReset: () => void;
  onBreakdown: (image: SelectedNailImage) => void;
  onTryOn: (image: SelectedNailImage) => void;
  onClose: () => void;
};

type SelectedVersion = 'original' | 'latest' | null;

export function CollageResultScreen({
  originalImage,
  latestImage,
  decals,
  extraText,
  drawerItems,
  onExtraTextChange,
  onPartialRegen,
  onFullReset,
  onBreakdown,
  onTryOn,
  onClose,
}: CollageResultScreenProps) {
  const [selectedVersion, setSelectedVersion] = useState<SelectedVersion>(null);
  const [checkedZones, setCheckedZones] = useState<Set<DrawerZoneId>>(new Set());
  const [localDecals, setLocalDecals] = useState<PlacedDecal[]>(decals);
  const [localExtraText, setLocalExtraText] = useState(extraText);

  const toggleZone = useCallback((zoneId: DrawerZoneId) => {
    setCheckedZones((prev) => {
      const next = new Set(prev);
      if (next.has(zoneId)) {
        next.delete(zoneId);
      } else {
        next.add(zoneId);
      }
      return next;
    });
  }, []);

  const handleRegen = useCallback(() => {
    onPartialRegen([...checkedZones], localDecals, localExtraText);
  }, [checkedZones, localDecals, localExtraText, onPartialRegen]);

  const selectedImage = selectedVersion === 'original' ? originalImage : latestImage;
  const canRegen = checkedZones.size > 0;

  // 如果 original 和 latest 是同一张图（首次生成），自动选用 latest
  const isSameImage = originalImage.imageBase64 === latestImage.imageBase64;

  return (
    <div className="collage-house-overlay collage-result-screen">
      {/* 星星背景 */}
      <div className="collage-bg-sparkles" aria-hidden="true">
        {['✦','✧','✦','✧','✦','✧','✦','✧','✦','✧'].map((s, i) => (
          <span key={i} className="collage-bg-sparkle" style={{ '--i': i } as React.CSSProperties}>{s}</span>
        ))}
      </div>

      {/* 顶栏 */}
      <div className="collage-result-topbar">
        <h1 className="collage-result-title">你的专属美甲 ✨</h1>
        <button type="button" className="collage-close-btn" aria-label="关闭" onClick={onClose}>✕</button>
      </div>

      {/* ① 双图对比 */}
      <div className="crs-compare-zone">
        <p className="crs-compare-label">
          {isSameImage ? '生成完成！选择满意后继续' : '点击「选用」确认满意的版本'}
        </p>
        <div className="crs-images-row">
          <div className={`crs-img-card${selectedVersion === 'original' ? ' crs-img-card--selected' : ''}`}>
            <div className="crs-img-wrap">
              <img
                src={`data:${originalImage.mimeType};base64,${originalImage.imageBase64}`}
                alt="原始版本"
                className="crs-img"
              />
              <span className="crs-img-tag crs-img-tag--original">原始</span>
              <div className="collage-result-badge" aria-hidden="true">AI 生成</div>
            </div>
            <button
              type="button"
              className={`crs-select-btn${selectedVersion === 'original' ? ' crs-select-btn--active' : ''}`}
              onClick={() => setSelectedVersion('original')}
            >
              {selectedVersion === 'original' ? '✓ 已选用' : '选用原始'}
            </button>
          </div>

          <div className={`crs-img-card${selectedVersion === 'latest' ? ' crs-img-card--selected' : ''}`}>
            <div className="crs-img-wrap">
              <img
                src={`data:${latestImage.mimeType};base64,${latestImage.imageBase64}`}
                alt="最新版本"
                className="crs-img"
              />
              <span className="crs-img-tag crs-img-tag--latest">最新</span>
              <div className="collage-result-badge" aria-hidden="true">AI 生成</div>
            </div>
            <button
              type="button"
              className={`crs-select-btn${selectedVersion === 'latest' ? ' crs-select-btn--active' : ''}`}
              onClick={() => setSelectedVersion('latest')}
            >
              {selectedVersion === 'latest' ? '✓ 已选用' : '选用最新'}
            </button>
          </div>
        </div>
      </div>

      {/* ② 元素勾选面板 */}
      <div className="crs-section-label">修改部分元素后重新生成</div>
      <div className="crs-ingredient-panel">
        {DRAWER_ZONES.map((zone) => {
          const isChecked = checkedZones.has(zone.id);
          const currentDecal = localDecals.find((d) => {
            const zoneCategory = drawerItems[zone.id]?.[0]?.category ?? zone.id;
            return d.item.category === zoneCategory;
          });
          return (
            <div key={zone.id}>
              <div
                className={`crs-ingredient-row${isChecked ? ' crs-ingredient-row--checked' : ''}`}
                onClick={() => toggleZone(zone.id)}
                role="checkbox"
                aria-checked={isChecked}
                tabIndex={0}
                onKeyDown={(e) => e.key === ' ' && toggleZone(zone.id)}
              >
                <div className="crs-ingredient-left">
                  <span className="crs-ingredient-icon" aria-hidden="true">
                    {drawerItems[zone.id]?.[0]?.emoji ?? '🎨'}
                  </span>
                  <div>
                    <div className="crs-ingredient-name">{zone.label}</div>
                    <div className={`crs-ingredient-value${isChecked ? ' crs-ingredient-value--active' : ''}`}>
                      {isChecked
                        ? '已勾选 — 从下方抽屉拖入新元素'
                        : currentDecal
                          ? currentDecal.item.label
                          : '未选择'}
                    </div>
                  </div>
                </div>
                <div className={`crs-checkbox${isChecked ? ' crs-checkbox--on' : ''}`} aria-hidden="true">
                  {isChecked ? '✓' : ''}
                </div>
              </div>

              {/* 勾选后内联展开抽屉 */}
              {isChecked && (
                <div className="crs-inline-drawer">
                  <div className="crs-drawer-header">
                    <span className="crs-drawer-title">{drawerItems[zone.id]?.[0]?.emoji} {zone.label}元素</span>
                    <button
                      type="button"
                      className="crs-drawer-close"
                      onClick={(e) => { e.stopPropagation(); toggleZone(zone.id); }}
                    >
                      ✕ 取消勾选
                    </button>
                  </div>
                  <div className="crs-drawer-items">
                    {drawerItems[zone.id].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="crs-drawer-item"
                        onClick={() => {
                          setLocalDecals((prev) => {
                            const filtered = prev.filter((d) => d.item.category !== item.category);
                            return [...filtered, { key: `crs-${item.id}`, item, px: 50, py: 50 }];
                          });
                        }}
                      >
                        <div className="crs-drawer-item-img">{item.emoji}</div>
                        <div className="crs-drawer-item-label">{item.label}</div>
                      </button>
                    ))}
                  </div>
                  <p className="crs-drawer-hint">点击选择，或返回编辑台拖拽放置</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ③ 额外需求文字 */}
      <div className="crs-text-section">
        <div className="crs-section-label" style={{ padding: '0 0 var(--space-2)' }}>额外需求</div>
        <textarea
          className="crs-text-box"
          value={localExtraText}
          onChange={(e) => {
            setLocalExtraText(e.target.value);
            onExtraTextChange(e.target.value);
          }}
          rows={2}
          maxLength={200}
          placeholder="输入额外的美甲需求..."
        />
      </div>

      {/* ④ 重新生成行 */}
      <div className="crs-regen-zone">
        <button type="button" className="crs-reset-btn" onClick={onFullReset}>
          ↺ 全部重置
        </button>
        <button
          type="button"
          className="crs-regen-btn"
          onClick={handleRegen}
          disabled={!canRegen}
        >
          重新生成选中部分 →
        </button>
      </div>

      {/* ⑤ 继续区 — 仅 selectedVersion 非 null 时可见 */}
      <div
        className="crs-continue-zone"
        style={{ display: selectedVersion !== null ? 'block' : 'none' }}
        aria-hidden={selectedVersion === null}
      >
        <div className="crs-continue-header">
          ✓ 已选用「{selectedVersion === 'original' ? '原始' : '最新'}」版本，可以继续了
        </div>
        <div className="crs-continue-actions">
          <button
            type="button"
            className="collage-result-action-btn collage-result-action-primary"
            onClick={() => selectedImage && onBreakdown(selectedImage)}
          >
            <span aria-hidden="true">🔍</span> AI 识别报价
          </button>
          <button
            type="button"
            className="collage-result-action-btn collage-result-action-secondary"
            onClick={() => selectedImage && onTryOn(selectedImage)}
          >
            <span aria-hidden="true">🖐️</span> 虚拟试戴
          </button>
        </div>
      </div>
    </div>
  );
}
