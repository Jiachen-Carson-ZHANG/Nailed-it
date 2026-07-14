'use client';

import { useState, useCallback } from 'react';
import type { SelectedNailImage } from '@/components/ui/ImageUploader';
import { type DrawerZoneId, DRAWER_ZONES } from './studio-layout-config';
import type { DrawerItem, PlacedDecal } from './CollageHousePanel';

export type CollageResultScreenProps = {
  originalImage: SelectedNailImage;
  latestImage: SelectedNailImage;
  decals: PlacedDecal[];
  extraText: string;
  drawerItems: Record<DrawerZoneId, DrawerItem[]>;
  onExtraTextChange: (text: string) => void;
  /** 返回新生成图的 imageBase64，由子组件自己管理 loading 状态 */
  onPartialRegen: (checkedZones: DrawerZoneId[], newDecals: PlacedDecal[], newExtraText: string) => Promise<string>;
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
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  // 局部重新生成后的最新图，优先于 prop 传入的 latestImage
  const [localLatestImage, setLocalLatestImage] = useState<SelectedNailImage | null>(null);

  const displayLatest = localLatestImage ?? latestImage;

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

  const handleRegen = useCallback(async () => {
    setIsRegenerating(true);
    setRegenError(null);
    try {
      const newBase64 = await onPartialRegen([...checkedZones], localDecals, localExtraText);
      setLocalLatestImage({ imageBase64: newBase64, mimeType: 'image/png', previewUrl: `data:image/png;base64,${newBase64}` });
      // 重新生成成功后切换到双图对比模式，自动选用最新版本
      setSelectedVersion('latest');
      setCheckedZones(new Set());
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : '生成失败，请稍后重试');
    } finally {
      setIsRegenerating(false);
    }
  }, [checkedZones, localDecals, localExtraText, onPartialRegen]);

  // 首次生成时（尚未局部重新生成）original === latest，单图模式；局部重新生成后切换为双图对比
  const isSameImage = localLatestImage === null && originalImage.imageBase64 === latestImage.imageBase64;

  // 单图模式下视为已选用 latest，双图模式下需用户主动选用
  const effectiveSelectedVersion: SelectedVersion = isSameImage ? 'latest' : selectedVersion;
  const selectedImage = effectiveSelectedVersion === 'original' ? originalImage : displayLatest;
  const canRegen = checkedZones.size > 0;

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

      {/* ① 图片区：首次生成单图大图，重新生成后双图对比 */}
      <div className="crs-compare-zone">
        {isSameImage ? (
          /* 单图模式：首次生成，只展示一张 */
          <>
            <div className="crs-single-img-wrap">
              <img
                src={`data:${displayLatest.mimeType};base64,${displayLatest.imageBase64}`}
                alt="AI生成的专属美甲效果图"
                className="crs-single-img"
              />
              <div className="collage-result-badge" aria-hidden="true">AI 生成</div>
            </div>
            <p className="crs-compare-label" style={{ marginTop: 'var(--space-2)' }}>
              喜欢这个方案？可以继续，或修改元素重新生成
            </p>
          </>
        ) : (
          /* 双图对比模式：局部重新生成后 */
          <>
            <p className="crs-compare-label">点击「选用」确认满意的版本</p>
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
                  {isRegenerating ? (
                    <div className="crs-img crs-img-loading" aria-label="生成中">
                      <span className="crs-img-loading-spinner" aria-hidden="true">✦</span>
                      <span style={{ fontSize: '0.75rem', color: '#8b6030', marginTop: '8px' }}>生成中…</span>
                    </div>
                  ) : (
                    <img
                      src={`data:${displayLatest.mimeType};base64,${displayLatest.imageBase64}`}
                      alt="最新版本"
                      className="crs-img"
                    />
                  )}
                  <span className="crs-img-tag crs-img-tag--latest">最新</span>
                  {!isRegenerating && <div className="collage-result-badge" aria-hidden="true">AI 生成</div>}
                </div>
                <button
                  type="button"
                  className={`crs-select-btn${selectedVersion === 'latest' ? ' crs-select-btn--active' : ''}`}
                  onClick={() => !isRegenerating && setSelectedVersion('latest')}
                  disabled={isRegenerating}
                >
                  {selectedVersion === 'latest' ? '✓ 已选用' : '选用最新'}
                </button>
              </div>
            </div>
          </>
        )}
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
        <button type="button" className="crs-reset-btn" onClick={onFullReset} disabled={isRegenerating}>
          ↺ 全部重置
        </button>
        <button
          type="button"
          className="crs-regen-btn"
          onClick={handleRegen}
          disabled={!canRegen || isRegenerating}
        >
          {isRegenerating ? '生成中…' : '重新生成选中部分 →'}
        </button>
      </div>
      {regenError && (
        <p className="crs-regen-error">{regenError}</p>
      )}

      {/* ⑤ 继续区 — 单图模式始终可见；双图模式需选用后才可见 */}
      <div
        className="crs-continue-zone"
        style={{ display: effectiveSelectedVersion !== null ? 'block' : 'none' }}
        aria-hidden={effectiveSelectedVersion === null}
      >
        <div className="crs-continue-header">
          {isSameImage
            ? '满意这个方案？可以直接继续'
            : `✓ 已选用「${effectiveSelectedVersion === 'original' ? '原始' : '最新'}」版本，可以继续了`}
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
