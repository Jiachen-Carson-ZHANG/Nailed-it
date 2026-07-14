# 拼贴小屋结果页改版设计

**日期:** 2026-07-14  
**涉及文件:** `src/features/customer/CollageHousePanel.tsx`, `src/domain/collage-result-store.ts`

---

## 背景

当前"重新搭配"按钮会清空所有 decals 和 extraText，用户每次都从空白开始。结果页只展示一张生成图，无法局部修改后重新生成。本改版解决这两个问题。

---

## 目标

1. 点击"重新搭配"后回到编辑台，保留上次拖拽的 decals 和 extraText
2. 结果页支持局部重新生成：勾选想改的元素分类 → 抽屉内联展开 → 拖拽替换 → 重新生成
3. 结果页并列展示原始图与最新图，用户选用满意版本后底部才出现继续按钮

---

## 状态模型

### 新增两个图的 slot

```ts
originalImage: string | null   // 第一次生成的图，之后不再更新
latestImage: string | null     // 每次重新生成后更新
selectedVersion: 'original' | 'latest' | null  // null = 尚未选用
```

`collage-result-store.ts` 同步扩展，保存 `originalImage`（首次生成时写入，后续不覆盖）和 `latestImage`（每次生成写入）。

### 保留 decals / extraText

`onRetry` 移除 `setDecals([])` 和 `setExtraText('')`，仅重置 `genState` 和 `showResult`，让用户从上次基础继续修改。

---

## 结果页布局

```
┌──────────────────────────────┐
│  ← 拼贴小屋              保存 │  顶栏
├──────────────────────────────┤
│  [原始图]        [最新图 ✓]   │  双图并列
│  [选用原始]      [✓ 已选用]   │
├──────────────────────────────┤
│  修改部分元素后重新生成         │  元素勾选面板
│  □ 底色  粉紫渐变             │
│  ☑ 艺术  已勾选 —拖入新元素   │
│  ┌─ 艺术抽屉（内联展开）──────┐ │
│  │ 🌺玫瑰 🌿叶脉 🦋蝴蝶 … │ │
│  └──────────────────────────┘ │
│  □ 装饰  水钻点缀             │
├──────────────────────────────┤
│  额外需求                     │  可编辑文字
│  [想要更清新一点…           ] │
├──────────────────────────────┤
│  [↺ 全部重置] [重新生成选中→] │  重新生成行
├──────────────────────────────┤
│  ✓ 已选用「最新」版本          │  继续区（仅 selectedVersion
│  [🔍 AI识别报价][🖐️虚拟试戴]  │    非 null 时渲染）
└──────────────────────────────┘
```

---

## 交互规则

### 双图对比
- 首次进入结果页：`originalImage` = `latestImage`（同一张），两张图相同
- 每次"重新生成选中部分"完成后：仅 `latestImage` 更新，`originalImage` 不变
- 点击图片下方"选用"按钮 → 设置 `selectedVersion`，对应按钮变为"✓ 已选用"
- 可随时切换选用另一张

### 继续按钮出现条件
- `selectedVersion !== null` 时，底部继续区从隐藏变为可见（CSS `display` 切换，非条件渲染，避免布局跳动）
- 继续区显示当前选用版本名称，点击"AI 识别报价"或"虚拟试戴"使用该版本的图

### 元素勾选面板
- 列出当前 decals 中的所有分类（底色 / 甲型 / 艺术 / 装饰），每行显示分类名 + 当前元素名
- 勾选某分类 → 该分类对应的抽屉在行下方内联展开（slide-down 动画）
- 点"✕ 取消勾选"→ 收起抽屉并取消勾选
- 未勾选的分类在重新生成时直接复用上次的提示词片段（`buildNailPrompt` 只传入勾选分类的 ingredients）

### 额外需求文字
- 初始值 = 上次 `extraText`，可直接编辑，随本次重新生成提交

### 重新生成
- 按钮文案："重新生成选中部分 →"
- 只有至少勾选一个分类时可点击，否则禁用
- 生成完成后 `latestImage` 更新；若 `selectedVersion === 'latest'`，选用状态自动跟随新图（不需要用户重新点选）

### 全部重置
- 清空 decals、extraText、勾选状态，回到空白编辑台（等同于原"重新搭配"的清空行为）

---

## 组件拆分

当前 `CollageHousePanel.tsx` 612 行，结果页逻辑增加后会超重。将 `ResultScreen` 拆为独立文件：

```
src/features/customer/
  CollageHousePanel.tsx        — 编辑台主体（状态管理、拖拽、生成触发）
  CollageResultScreen.tsx      — 结果页（双图对比、勾选面板、继续按钮）  ← 新文件
```

`CollageResultScreen` 接收 props：

```ts
type CollageResultScreenProps = {
  originalImage: string;
  latestImage: string;
  decals: PlacedDecal[];
  extraText: string;
  onExtraTextChange: (text: string) => void;
  onPartialRegen: (checkedCategories: DrawerZoneId[], newIngredients: CollageIngredient[], newText: string) => void;
  onFullReset: () => void;
  onBreakdown: (image: string) => void;
  onTryOn: (image: string) => void;
  onClose: () => void;
};
```

---

## 不在本次范围内

- 超过 2 次生成的历史图管理（只保留原始 + 最新）
- 生成中途取消
- 图片下载 / 分享

---

## 测试要点

- `onRetry` 后 decals 和 extraText 保留
- 首次生成后 originalImage === latestImage
- 重新生成后 originalImage 不变，latestImage 更新
- 勾选分类后对应抽屉展开；取消勾选后收起
- `selectedVersion === null` 时继续区不可见；点选用后可见
- 只勾选部分分类时，`buildNailPrompt` 只接收勾选分类的 ingredients
