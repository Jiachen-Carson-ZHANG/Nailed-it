# 拼贴小屋结果页改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 结果页支持双图对比、局部元素勾选重新生成，并保留重新搭配时的 decals/extraText 状态。

**Architecture:** 将现有 `ResultScreen` 拆为独立的 `CollageResultScreen.tsx`，内部管理 `selectedVersion`（控制继续按钮可见性）和 `checkedCategories`（控制哪些分类参与重新生成）。`collage-result-store` 扩展为保存 `originalImage` + `latestImage` 两个 slot。`CollageHousePanel` 的 `onRetry` 逻辑修改为不清空 decals/extraText。

**Tech Stack:** React 18 useState/useCallback · Next.js App Router · TypeScript · CSS in globals.css（遵循现有 BEM-like 命名）

---

## File Map

| 操作 | 路径 | 职责变化 |
|------|------|---------|
| Modify | `src/domain/collage-result-store.ts` | 扩展为双 slot（originalImage / latestImage） |
| Create | `src/features/customer/CollageResultScreen.tsx` | 新结果页组件（双图、勾选面板、继续按钮） |
| Modify | `src/features/customer/CollageHousePanel.tsx` | 移除 ResultScreen 定义；更新 onRetry；传新 props 给 CollageResultScreen；handleGenerate 调用新 store API |
| Modify | `src/app/globals.css` | 新增结果页相关 CSS 类 |

---

## Task 1: 扩展 collage-result-store

**Files:**
- Modify: `src/domain/collage-result-store.ts`
- Test: `src/domain/collage-result-store.test.ts`（新建）

- [ ] **Step 1: 写失败测试**

新建 `src/domain/collage-result-store.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveOriginalCollageResult,
  saveLatestCollageResult,
  getCollageImages,
  clearCollageResult,
} from './collage-result-store';

const img1 = { imageBase64: 'aaa', mimeType: 'image/png' as const, previewUrl: 'data:image/png;base64,aaa' };
const img2 = { imageBase64: 'bbb', mimeType: 'image/png' as const, previewUrl: 'data:image/png;base64,bbb' };

describe('collage-result-store', () => {
  beforeEach(() => clearCollageResult());

  it('getCollageImages returns null before any save', () => {
    expect(getCollageImages()).toEqual({ original: null, latest: null });
  });

  it('saveOriginalCollageResult sets both slots on first call', () => {
    saveOriginalCollageResult(img1);
    expect(getCollageImages()).toEqual({ original: img1, latest: img1 });
  });

  it('saveOriginalCollageResult does NOT overwrite original on subsequent calls', () => {
    saveOriginalCollageResult(img1);
    saveOriginalCollageResult(img2);
    expect(getCollageImages().original).toEqual(img1);
    expect(getCollageImages().latest).toEqual(img1);
  });

  it('saveLatestCollageResult updates latest but not original', () => {
    saveOriginalCollageResult(img1);
    saveLatestCollageResult(img2);
    expect(getCollageImages().original).toEqual(img1);
    expect(getCollageImages().latest).toEqual(img2);
  });

  it('clearCollageResult resets both slots', () => {
    saveOriginalCollageResult(img1);
    clearCollageResult();
    expect(getCollageImages()).toEqual({ original: null, latest: null });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- collage-result-store
```

期望：FAIL — `saveOriginalCollageResult is not a function`

- [ ] **Step 3: 实现新的 store**

将 `src/domain/collage-result-store.ts` 整体替换为：

```ts
import type { SelectedNailImage } from '@/components/ui/ImageUploader';

let originalImage: SelectedNailImage | null = null;
let latestImage: SelectedNailImage | null = null;

/** 首次生成时调用。同时设置 original 和 latest；后续调用不覆盖 original。 */
export function saveOriginalCollageResult(image: SelectedNailImage): void {
  if (!originalImage) {
    originalImage = image;
  }
  latestImage = image;
}

/** 局部重新生成完成后调用，只更新 latest，original 不变。 */
export function saveLatestCollageResult(image: SelectedNailImage): void {
  latestImage = image;
}

export function getCollageImages(): { original: SelectedNailImage | null; latest: SelectedNailImage | null } {
  return { original: originalImage, latest: latestImage };
}

/** 保留旧名以供返回导航逻辑使用（返回时只需要知道 latest）。 */
export function getCollageResult(): SelectedNailImage | null {
  return latestImage;
}

export function clearCollageResult(): void {
  originalImage = null;
  latestImage = null;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- collage-result-store
```

期望：PASS — 5 tests

- [ ] **Step 5: 提交**

```bash
git add src/domain/collage-result-store.ts src/domain/collage-result-store.test.ts
git commit -m "feat(collage-store): dual-slot originalImage + latestImage"
```

---

## Task 2: 新建 CollageResultScreen 组件（结构骨架）

**Files:**
- Create: `src/features/customer/CollageResultScreen.tsx`

这个任务只建组件骨架和 props 类型，不含完整 UI，下一个 task 补充 UI 和 CSS。

- [ ] **Step 1: 确认类型来源**

`DrawerZoneId` 来自 `./studio-layout-config`，`DRAWER_ITEMS` 需要从 `CollageHousePanel.tsx` 导出（Task 3 处理），`PlacedDecal` 和 `DrawerItem` 也需要从 `CollageHousePanel.tsx` 导出（Task 3 处理）。本 task 先用 inline 类型占位，Task 3 替换为 import。

- [ ] **Step 2: 创建组件文件**

新建 `src/features/customer/CollageResultScreen.tsx`：

```tsx
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
```

- [ ] **Step 3: 确认 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | grep CollageResultScreen
```

期望：无输出（无报错）

---

## Task 3: 从 CollageHousePanel 导出共享类型和数据

**Files:**
- Modify: `src/features/customer/CollageHousePanel.tsx`（导出 `PlacedDecal`、`DrawerItem`、`DRAWER_ITEMS`）
- Modify: `src/features/customer/CollageResultScreen.tsx`（替换 inline 类型为 import）

- [ ] **Step 1: 在 CollageHousePanel.tsx 中将类型和数据改为 export**

在 `CollageHousePanel.tsx` 第 17 行，将 `type DrawerItem` 改为 `export type DrawerItem`：

```ts
export type DrawerItem = {
  id: string;
  label: string;
  emoji: string;
  category: string;
  description: string;
};
```

第 25 行，将 `type PlacedDecal` 改为 `export type PlacedDecal`：

```ts
export type PlacedDecal = {
  key: string;
  item: DrawerItem;
  px: number;
  py: number;
};
```

第 41 行，将 `const DRAWER_ITEMS` 改为 `export const DRAWER_ITEMS`：

```ts
export const DRAWER_ITEMS: Record<DrawerZoneId, DrawerItem[]> = {
```

- [ ] **Step 2: 在 CollageResultScreen.tsx 中替换 inline 类型为 import**

将文件顶部的 inline 类型定义替换为：

```tsx
import type { DrawerItem, PlacedDecal } from './CollageHousePanel';
import { DRAWER_ITEMS as DEFAULT_DRAWER_ITEMS } from './CollageHousePanel';
```

同时移除文件中的：
- `type DrawerItem = { ... }` 整段
- `type PlacedDecal = { ... }` 整段
- `type DrawerItemsMap = Record<DrawerZoneId, DrawerItem[]>` 这行

- [ ] **Step 3: 确认 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -20
```

期望：无输出

- [ ] **Step 4: 提交**

```bash
git add src/features/customer/CollageHousePanel.tsx src/features/customer/CollageResultScreen.tsx
git commit -m "refactor(collage): export shared types + extract CollageResultScreen skeleton"
```

---

## Task 4: 新增 CSS 样式

**Files:**
- Modify: `src/app/globals.css`（在 `.collage-result-retry-btn` 结尾之后追加新类）

- [ ] **Step 1: 在 globals.css 末尾的 collage 区块后追加以下 CSS**

找到 `.collage-result-retry-btn` 块的结尾（约第 8480 行），在其后追加：

```css
/* ── CollageResultScreen (crs-*) ────────────────────────────────────────── */
.crs-compare-zone {
  padding: var(--space-3) var(--space-4) var(--space-2);
  flex-shrink: 0;
}
.crs-compare-label {
  font-size: 0.75rem;
  color: #8b6030;
  margin-bottom: var(--space-2);
  text-align: center;
}
.crs-images-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}
.crs-img-card {
  border-radius: 1rem;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.15s ease;
}
.crs-img-card--selected {
  border-color: #c08030;
  box-shadow: 0 0 0 2px rgba(192, 128, 48, 0.25);
}
.crs-img-wrap {
  position: relative;
}
.crs-img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}
.crs-img-tag {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  font-size: 0.62rem;
  font-weight: 800;
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
}
.crs-img-tag--original {
  background: rgba(0,0,0,0.45);
  color: #eee;
}
.crs-img-tag--latest {
  background: #c08030;
  color: #fff;
}
.crs-select-btn {
  width: 100%;
  padding: var(--space-2) 0;
  border: none;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  background: rgba(245, 239, 224, 0.9);
  color: #8b6030;
  transition: background 0.15s ease, color 0.15s ease;
}
.crs-select-btn--active {
  background: #c08030;
  color: #fff;
}
.crs-section-label {
  font-size: 0.7rem;
  color: #a07840;
  padding: var(--space-2) var(--space-4) var(--space-1);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}
.crs-ingredient-panel {
  padding: 0 var(--space-4) var(--space-1);
  flex-shrink: 0;
}
.crs-ingredient-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: 0.75rem;
  margin-bottom: var(--space-1);
  background: rgba(255,255,255,0.55);
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.crs-ingredient-row--checked {
  background: rgba(255,248,235,0.9);
  border-color: rgba(192,128,48,0.4);
}
.crs-ingredient-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.crs-ingredient-icon {
  font-size: 1.2rem;
  width: 28px;
  text-align: center;
}
.crs-ingredient-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: #5a3a10;
}
.crs-ingredient-value {
  font-size: 0.72rem;
  color: #a08040;
  margin-top: 1px;
}
.crs-ingredient-value--active {
  color: #c08030;
  font-weight: 600;
}
.crs-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1.5px solid #c8a060;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  flex-shrink: 0;
  color: #fff;
  transition: background 0.15s ease;
}
.crs-checkbox--on {
  background: #c08030;
  border-color: #c08030;
}
.crs-inline-drawer {
  margin: 0 0 var(--space-2);
  background: rgba(255,248,235,0.95);
  border-radius: 0.75rem;
  border: 1px solid rgba(192,128,48,0.3);
  overflow: hidden;
  animation: crsDrawerSlideDown 0.2s ease-out both;
}
@keyframes crsDrawerSlideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: none; }
}
.crs-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: rgba(192,128,48,0.1);
}
.crs-drawer-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #7a4c10;
}
.crs-drawer-close {
  font-size: 0.72rem;
  color: #a07840;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.crs-drawer-items {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.crs-drawer-items::-webkit-scrollbar { display: none; }
.crs-drawer-item {
  flex-shrink: 0;
  width: 52px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: center;
  padding: 0;
}
.crs-drawer-item-img {
  width: 52px;
  height: 52px;
  border-radius: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  border: 1.5px solid rgba(192,128,48,0.25);
  background: rgba(255,255,255,0.7);
  transition: border-color 0.12s ease, background 0.12s ease;
}
.crs-drawer-item:active .crs-drawer-item-img {
  border-color: #c08030;
  background: rgba(192,128,48,0.1);
}
.crs-drawer-item-label {
  font-size: 0.65rem;
  color: #8b6030;
  margin-top: 3px;
}
.crs-drawer-hint {
  font-size: 0.7rem;
  color: #a08040;
  padding: 0 var(--space-3) var(--space-2);
}
.crs-text-section {
  padding: 0 var(--space-4) var(--space-2);
  flex-shrink: 0;
}
.crs-text-box {
  width: 100%;
  background: rgba(255,255,255,0.7);
  border: 1.5px solid rgba(192,128,48,0.25);
  border-radius: 0.75rem;
  padding: var(--space-2) var(--space-3);
  font-size: 0.78rem;
  color: #5a3a10;
  resize: none;
  font-family: inherit;
  line-height: 1.5;
}
.crs-text-box:focus {
  outline: none;
  border-color: #c08030;
}
.crs-regen-zone {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-4) var(--space-2);
  flex-shrink: 0;
}
.crs-reset-btn {
  padding: 0.7rem var(--space-3);
  border: none;
  border-radius: var(--radius-pill);
  background: rgba(255,255,255,0.6);
  color: #a07840;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.crs-regen-btn {
  flex: 1;
  padding: 0.7rem var(--space-3);
  border: none;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, #c08030, #a06020);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(160,90,20,0.3);
  transition: opacity 0.15s ease;
}
.crs-regen-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
.crs-continue-zone {
  margin: 0 var(--space-4) var(--space-4);
  border-radius: 1rem;
  overflow: hidden;
  border: 1.5px solid rgba(192,128,48,0.35);
  animation: crsDrawerSlideDown 0.2s ease-out both;
  flex-shrink: 0;
}
.crs-continue-header {
  background: rgba(192,128,48,0.12);
  padding: var(--space-2) var(--space-3);
  font-size: 0.75rem;
  font-weight: 700;
  color: #7a4c10;
}
.crs-continue-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
}
```

- [ ] **Step 2: 启动 dev server 检查无 CSS 报错**

```bash
./dev
```

浏览器打开后确认无控制台报错。可以关掉 dev server。

- [ ] **Step 3: 提交**

```bash
git add src/app/globals.css
git commit -m "feat(collage): add crs-* CSS classes for CollageResultScreen"
```

---

## Task 5: 更新 CollageHousePanel 接入新组件

**Files:**
- Modify: `src/features/customer/CollageHousePanel.tsx`

这个任务完成后，整个功能在浏览器中可以手动验证。

- [ ] **Step 1: 更新 import**

在文件顶部，将：
```ts
import { saveCollageResult, getCollageResult, clearCollageResult } from '@/domain/collage-result-store';
```
替换为：
```ts
import {
  saveOriginalCollageResult,
  saveLatestCollageResult,
  getCollageResult,
  clearCollageResult,
  getCollageImages,
} from '@/domain/collage-result-store';
import { CollageResultScreen } from './CollageResultScreen';
```

- [ ] **Step 2: 扩展 state 以追踪 latestImage 更新**

在 `CollageHousePanel` 组件内，找到 `const [showResult, setShowResult] = useState(hasRestored);`（约第 137 行），在其下方新增：

```ts
// 追踪最新生成图，用于局部重新生成后更新 CollageResultScreen
const [latestImageBase64, setLatestImageBase64] = useState<string | null>(
  hasRestored ? restored.current!.imageBase64 : null
);
```

- [ ] **Step 3: 修改 handleGenerate — 首次生成用 saveOriginalCollageResult**

找到 `handleGenerate` 中的 `saveCollageResult(...)` 调用（约第 305 行），替换为：

```ts
const collageImage = {
  imageBase64: data.imageBase64,
  mimeType: 'image/png' as const,
  previewUrl: `data:image/png;base64,${data.imageBase64}`,
};
saveOriginalCollageResult(collageImage);
setLatestImageBase64(data.imageBase64);
setGenState({ phase: 'done', imageBase64: data.imageBase64 });
```

（移除原有的 `setGenState` 那行，因为已合并进来）

- [ ] **Step 4: 新增 handlePartialRegen 函数**

在 `handleGenerate` 函数之后，新增：

```ts
const handlePartialRegen = async (
  _checkedZones: DrawerZoneId[],
  newDecals: PlacedDecal[],
  newExtraText: string,
) => {
  if (newExtraText.trim() && isOffTopic(newExtraText)) {
    return; // CollageResultScreen 不走 inputError，简单忽略
  }
  const prompt = buildPrompt(newDecals, newExtraText);
  setGenState({ phase: 'loading' });
  setShowResult(false);
  try {
    const ingredients = newDecals.map((d) => ({ category: d.item.category, label: d.item.description }));
    const res = await fetch('/api/ai/collage-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: ingredients.length > 0 ? ingredients : [{ category: '风格', label: '精致美甲' }],
        customText: prompt,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const data = await res.json() as { imageBase64: string };
    const collageImage = {
      imageBase64: data.imageBase64,
      mimeType: 'image/png' as const,
      previewUrl: `data:image/png;base64,${data.imageBase64}`,
    };
    saveLatestCollageResult(collageImage);
    setLatestImageBase64(data.imageBase64);
    setDecals(newDecals);
    setExtraText(newExtraText);
    setGenState({ phase: 'done', imageBase64: data.imageBase64 });
  } catch (e) {
    setGenState({ phase: 'error', message: e instanceof Error ? e.message : '生成失败，请稍后重试' });
  }
};
```

- [ ] **Step 5: 修改 onRetry — 不清空 decals/extraText**

找到 `onRetry` 回调（约第 347 行）：

```ts
onRetry={() => { clearCollageResult(); setGenState({ phase: 'idle' }); setDecals([]); setExtraText(''); setShowResult(false); }}
```

替换为：

```ts
onRetry={() => {
  clearCollageResult();
  setLatestImageBase64(null);
  setGenState({ phase: 'idle' });
  setShowResult(false);
}}
```

- [ ] **Step 6: 替换 ResultScreen 渲染为 CollageResultScreen**

找到结果页渲染代码（约第 341 行的 `const rs = collageImage ? ...`），整段替换为：

```tsx
const collageImages = getCollageImages();
const originalImg = collageImages.original ?? collageImage;
const latestImg = collageImages.latest ?? collageImage;

const rs = collageImage ? (
  <div style={showResult
    ? { position: 'absolute', inset: 0, zIndex: 199 }
    : { position: 'absolute', inset: 0, zIndex: 199, visibility: 'hidden', pointerEvents: 'none' }}>
    <CollageResultScreen
      originalImage={originalImg!}
      latestImage={latestImg!}
      decals={decals}
      extraText={extraText}
      drawerItems={DRAWER_ITEMS}
      onExtraTextChange={setExtraText}
      onPartialRegen={handlePartialRegen}
      onFullReset={() => {
        clearCollageResult();
        setLatestImageBase64(null);
        setGenState({ phase: 'idle' });
        setDecals([]);
        setExtraText('');
        setShowResult(false);
      }}
      onBreakdown={(img) => {
        clearBreakdownResults();
        clearCollageResult();
        saveTryOnImage(img);
        router.push(getCustomerBookingPath());
      }}
      onTryOn={(img) => {
        clearCollageResult();
        saveTryOnStyleImage(img);
        router.push(getCustomerTryOnPath());
      }}
      onClose={() => {
        clearCollageResult();
        setLatestImageBase64(null);
        setOpen(false);
        setGenState({ phase: 'idle' });
        setShowResult(false);
      }}
    />
  </div>
) : null;
```

- [ ] **Step 7: 移除旧的 ResultScreen 函数定义**

删除文件末尾的 `ResultScreen` 类型和函数定义（约第 574–611 行）：
- 删除 `type ResultScreenProps = { ... }`
- 删除 `function ResultScreen(...) { ... }`

- [ ] **Step 8: 确认 TypeScript 无报错**

```bash
npx tsc --noEmit 2>&1 | head -30
```

期望：无输出

- [ ] **Step 9: 提交**

```bash
git add src/features/customer/CollageHousePanel.tsx
git commit -m "feat(collage): wire CollageResultScreen into CollageHousePanel"
```

---

## Task 6: 手动验证（浏览器）

**Files:** 无代码变更，只验证

- [ ] **Step 1: 启动 dev server**

```bash
./dev
```

访问 http://localhost:3000，登录（或使用 demo 账号）。

- [ ] **Step 2: 验证首次生成**

1. 打开拼贴小屋
2. 拖入几个元素，输入额外需求
3. 点"AI 生成美甲效果图"
4. 加载完成后，确认：
   - 双图区左右两张图**相同**（首次生成，original = latest）
   - 两张图下方均显示"选用"按钮
   - 底部**没有**继续按钮区

- [ ] **Step 3: 验证选用触发继续按钮**

1. 点击右侧"选用最新"
2. 确认按钮变为"✓ 已选用"
3. 确认页面底部出现继续区，显示"✓ 已选用「最新」版本，可以继续了"
4. 确认"AI 识别报价"和"虚拟试戴"按钮可点击

- [ ] **Step 4: 验证局部重新生成**

1. 在结果页勾选一个分类（如"艺术"）
2. 确认对应抽屉在该行下方内联展开
3. 点击抽屉中一个元素
4. 点"重新生成选中部分 →"
5. 加载完成后：
   - 左侧原始图**不变**
   - 右侧最新图**更新为新图**
   - 若之前已选用最新，选用状态保持

- [ ] **Step 5: 验证重新搭配保留状态**

1. 在结果页点"全部重置"
2. 确认回到编辑台，decals 已清空（全部重置行为）
3. 重新生成一张图
4. 在结果页**不点全部重置**，直接在编辑台返回（点顶栏 ← 或关闭结果页）
5. 确认编辑台中之前拖拽的 decals 和 extraText 都还在

- [ ] **Step 6: 提交验证记录**

```bash
git commit --allow-empty -m "chore: manual verification passed for collage result page redesign"
```

---

## Task 7: 补充单元测试

**Files:**
- Test: `src/features/customer/CollageResultScreen.test.tsx`（新建）

- [ ] **Step 1: 写测试**

新建 `src/features/customer/CollageResultScreen.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CollageResultScreen } from './CollageResultScreen';
import { DRAWER_ITEMS } from './CollageHousePanel';

const img1 = { imageBase64: 'aaa', mimeType: 'image/png' as const, previewUrl: 'data:image/png;base64,aaa' };
const img2 = { imageBase64: 'bbb', mimeType: 'image/png' as const, previewUrl: 'data:image/png;base64,bbb' };

const baseProps = {
  originalImage: img1,
  latestImage: img2,
  decals: [],
  extraText: '测试需求',
  drawerItems: DRAWER_ITEMS,
  onExtraTextChange: vi.fn(),
  onPartialRegen: vi.fn(),
  onFullReset: vi.fn(),
  onBreakdown: vi.fn(),
  onTryOn: vi.fn(),
  onClose: vi.fn(),
};

describe('CollageResultScreen', () => {
  it('继续按钮区在未选用时不可见', () => {
    render(<CollageResultScreen {...baseProps} />);
    const zone = document.querySelector('.crs-continue-zone') as HTMLElement;
    expect(zone.style.display).toBe('none');
  });

  it('点击「选用最新」后继续按钮区可见', () => {
    render(<CollageResultScreen {...baseProps} />);
    fireEvent.click(screen.getByText('选用最新'));
    const zone = document.querySelector('.crs-continue-zone') as HTMLElement;
    expect(zone.style.display).toBe('block');
    expect(screen.getByText(/已选用「最新」版本/)).toBeTruthy();
  });

  it('点击「选用原始」后继续按钮区可见且标注原始', () => {
    render(<CollageResultScreen {...baseProps} />);
    fireEvent.click(screen.getByText('选用原始'));
    expect(screen.getByText(/已选用「原始」版本/)).toBeTruthy();
  });

  it('未勾选任何分类时重新生成按钮禁用', () => {
    render(<CollageResultScreen {...baseProps} />);
    const btn = screen.getByText('重新生成选中部分 →') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('勾选分类后重新生成按钮可用，点击触发 onPartialRegen', () => {
    render(<CollageResultScreen {...baseProps} />);
    const colorRow = screen.getByRole('checkbox', { name: /底色/ });
    fireEvent.click(colorRow);
    const btn = screen.getByText('重新生成选中部分 →') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(baseProps.onPartialRegen).toHaveBeenCalledWith(
      expect.arrayContaining(['color']),
      expect.any(Array),
      '测试需求',
    );
  });

  it('勾选分类后该分类的抽屉内联展开', () => {
    render(<CollageResultScreen {...baseProps} />);
    const colorRow = screen.getByRole('checkbox', { name: /底色/ });
    fireEvent.click(colorRow);
    expect(document.querySelector('.crs-inline-drawer')).toBeTruthy();
  });

  it('点「全部重置」触发 onFullReset', () => {
    render(<CollageResultScreen {...baseProps} />);
    fireEvent.click(screen.getByText('↺ 全部重置'));
    expect(baseProps.onFullReset).toHaveBeenCalled();
  });

  it('点「AI 识别报价」在已选用 latest 时传入 latestImage', () => {
    render(<CollageResultScreen {...baseProps} />);
    fireEvent.click(screen.getByText('选用最新'));
    fireEvent.click(screen.getByText(/AI 识别报价/));
    expect(baseProps.onBreakdown).toHaveBeenCalledWith(img2);
  });
});
```

- [ ] **Step 2: 运行测试**

```bash
npm test -- CollageResultScreen
```

期望：PASS — 8 tests

- [ ] **Step 3: 提交**

```bash
git add src/features/customer/CollageResultScreen.test.tsx
git commit -m "test(collage): CollageResultScreen unit tests"
```

---

## Self-Review

**Spec coverage check:**

| 需求 | 覆盖 task |
|------|----------|
| onRetry 保留 decals/extraText | Task 5 Step 5 |
| collage-result-store 双 slot | Task 1 |
| 双图并列，原始图不被覆盖 | Task 2 + Task 5 Step 6 |
| 勾选即展开抽屉 | Task 2（组件内 `isChecked && <crs-inline-drawer>`） |
| 额外需求文字可编辑 | Task 2（`<textarea>` with `onExtraTextChange`） |
| 重新生成仅传入勾选分类 | Task 5 Step 4（`handlePartialRegen`） |
| selectedVersion 控制继续按钮 | Task 2（`display: selectedVersion !== null ? 'block' : 'none'`） |
| 全部重置清空所有状态 | Task 5 Step 6（`onFullReset` prop） |
| CSS 样式 | Task 4 |
| 单元测试 | Task 1 + Task 7 |

**Placeholder scan:** 无 TBD/TODO 遗留。

**Type consistency:** 所有 task 中 `DrawerZoneId`、`PlacedDecal`、`DrawerItem`、`CollageResultScreenProps` 命名一致。`saveOriginalCollageResult`/`saveLatestCollageResult`/`getCollageImages`/`clearCollageResult` 在 Task 1 定义，Task 5 使用，名称匹配。
