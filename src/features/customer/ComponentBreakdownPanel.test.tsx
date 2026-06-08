import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import {
  buildBreakdownResult,
  ComponentBreakdownPanel,
} from './ComponentBreakdownPanel';
import { breakdownPanelCopy } from './breakdown-panel-copy';
import type { BreakdownResult } from '@/domain/nail';
import { getDefaultSettings } from '@/data/glossary-settings-store';

const { listMerchantPricingSettingsActionMock } = vi.hoisted(() => ({
  listMerchantPricingSettingsActionMock: vi.fn(),
}));

vi.mock('@/lib/actions/merchant-pricing-actions', () => ({
  listMerchantPricingSettingsAction: listMerchantPricingSettingsActionMock,
}));

function renderPanel(cachedResult = buildCachedResult()) {
  return render(
    <LanguageProvider initialLanguage="zh-CN" role="customer">
      <ComponentBreakdownPanel image={null} cachedResult={cachedResult} autoAnalyze={false} />
    </LanguageProvider>,
  );
}

function buildCachedResult({
  structureIds = new Set<string>(),
  nailShape = null,
  nailLength = null,
  texture = null,
  colorIds = new Set<string>(),
  colorEffectIds = new Set<string>(),
  artIds = new Set<string>(),
  decoIds = new Set<string>(),
  quantities = new Map<string, number>(),
}: {
  structureIds?: Set<string>;
  nailShape?: string | null;
  nailLength?: string | null;
  texture?: string | null;
  colorIds?: Set<string>;
  colorEffectIds?: Set<string>;
  artIds?: Set<string>;
  decoIds?: Set<string>;
  quantities?: Map<string, number>;
} = {}): BreakdownResult {
  const settingsById = new Map(getDefaultSettings().map((setting) => [setting.id, setting]));

  return buildBreakdownResult(
    null,
    structureIds,
    nailShape,
    nailLength,
    texture,
    colorIds,
    colorEffectIds,
    artIds,
    decoIds,
    quantities,
    settingsById,
  );
}

function expandNailShapeAddButtons() {
  const shapeChipGroup = screen.getByRole('button', { name: '杏仁形' }).closest('.analyze-chip-group');
  const lengthChipGroup = screen.getByRole('button', { name: '短甲' }).closest('.analyze-chip-group');

  expect(shapeChipGroup).not.toBeNull();
  expect(lengthChipGroup).not.toBeNull();

  fireEvent.click(within(shapeChipGroup as HTMLElement).getByRole('button', { name: '添加选项' }));
  fireEvent.click(within(lengthChipGroup as HTMLElement).getByRole('button', { name: '添加选项' }));
}

describe('ComponentBreakdownPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    listMerchantPricingSettingsActionMock.mockReset();
    listMerchantPricingSettingsActionMock.mockResolvedValue([]);
  });

  it('uses the renamed shapeSection copy key for the simplified nail shape section title', () => {
    expect(breakdownPanelCopy['zh-CN']).toHaveProperty('shapeSection', '甲型');
    expect(breakdownPanelCopy.en).toHaveProperty('shapeSection', 'Shape');
    expect(breakdownPanelCopy['zh-CN']).not.toHaveProperty('shapeColor');
    expect(breakdownPanelCopy.en).not.toHaveProperty('shapeColor');
  });

  it('hydrates implied structure chips from the original structure selection and still allows deselecting them', async () => {
    renderPanel(
      buildCachedResult({
        structureIds: new Set(['nail_tip_full_cover']),
      }),
    );

    // 只输入原始结构项，真实走 hydration/派生路径，随后确认 implied chips 仍可手动取消。
    const builderGelChip = await screen.findByRole('button', { name: '建构' });
    const halfCoverTipChip = screen.getByRole('button', { name: '半贴甲片' });
    const fullCoverTipChip = screen.getByRole('button', { name: '全贴甲片' });
    const priceTable = screen.getByRole('table');

    expect(builderGelChip).toHaveAttribute('aria-pressed', 'true');
    expect(halfCoverTipChip).toHaveAttribute('aria-pressed', 'true');
    expect(within(priceTable).queryByText('建构')).not.toBeInTheDocument();
    expect(within(priceTable).queryByText('半贴甲片')).not.toBeInTheDocument();
    expect(within(priceTable).getByText('全贴甲片')).toBeInTheDocument();

    fireEvent.click(builderGelChip);
    fireEvent.click(halfCoverTipChip);

    expect(builderGelChip).toHaveAttribute('aria-pressed', 'false');
    expect(halfCoverTipChip).toHaveAttribute('aria-pressed', 'false');
    expect(fullCoverTipChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders the simplified nail shape section with lit chips first and expands hidden options via +N', () => {
    renderPanel(
      buildCachedResult({
        nailShape: 'shape_almond',
        nailLength: 'length_short',
        texture: 'texture_matte',
        colorIds: new Set(['color_nude']),
      }),
    );

    // 新设计把旧的“甲型 / 颜色”收敛成单一“甲型”区块，只保留甲型和甲长。
    expect(screen.queryByRole('heading', { name: '甲型 / 颜色' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '甲型' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '杏仁形' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '短甲' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '方形' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '长甲' })).not.toBeInTheDocument();

    // 先点亮命中项，再通过 +N 展开剩余候选，是新交互必须锁定的行为。
    expandNailShapeAddButtons();

    expect(screen.getByRole('button', { name: '方形' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '长甲' })).toBeInTheDocument();
  });

  it('keeps legacy finish_service items in the existing color effects set', () => {
    renderPanel(
      buildCachedResult({
        colorEffectIds: new Set(['matte_top']),
      }),
    );

    expect(screen.queryByText('质感')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '磨砂色' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows base color inside the color effects bucket instead of the old shape section', () => {
    renderPanel(
      buildCachedResult({
        colorIds: new Set(['color_nude']),
        colorEffectIds: new Set(['cat_eye']),
      }),
    );

    const colorToggle = screen.getByRole('button', { name: /颜色效果/ });

    // 若底色确实属于颜色效果 bucket，那么关闭该 bucket 后，底色标签和底色选项都应一起消失。
    expect(screen.getByText('底色（可多选）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '裸色' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '猫眼色' })).toBeInTheDocument();

    fireEvent.click(colorToggle);

    expect(screen.queryByText('底色（可多选）')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '裸色' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '猫眼色' })).not.toBeInTheDocument();
  });

  it('opens the color effects bucket by default when only base color is already selected', () => {
    renderPanel(
      buildCachedResult({
        colorIds: new Set(['color_nude']),
      }),
    );

    expect(screen.getByText('底色（可多选）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '裸色' })).toBeInTheDocument();
  });

  it('opens the art bucket by default when hydration only contains art selections', () => {
    renderPanel(
      buildCachedResult({
        artIds: new Set(['french_tip_basic']),
      }),
    );

    expect(screen.getByRole('button', { name: '普通法式' })).toBeInTheDocument();
    expect(screen.queryByText('底色（可多选）')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '贴纸' })).not.toBeInTheDocument();
  });

  it('opens the decoration bucket by default when hydration only contains decoration selections', () => {
    renderPanel(
      buildCachedResult({
        decoIds: new Set(['sticker']),
      }),
    );

    expect(screen.getByRole('button', { name: '贴纸' })).toBeInTheDocument();
    expect(screen.queryByText('底色（可多选）')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '普通法式' })).not.toBeInTheDocument();
  });

  it('keeps quantity controls interactive without breaking chip toggle semantics', () => {
    renderPanel(
      buildCachedResult({
        artIds: new Set(['french_tip_basic']),
        quantities: new Map([['french_tip_basic', 1]]),
      }),
    );

    const artChip = screen.getByRole('button', { name: '普通法式' });
    const increaseButton = screen.getByRole('button', { name: '增加数量' });
    const decreaseButton = screen.getByRole('button', { name: '减少数量' });
    const quantityInput = screen.getByRole('spinbutton', { name: '数量' }) as HTMLInputElement;

    fireEvent.click(increaseButton);
    expect(quantityInput.value).toBe('2');
    expect(artChip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(decreaseButton);
    expect(quantityInput.value).toBe('1');
    expect(artChip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(artChip);
    expect(screen.queryByRole('button', { name: '普通法式' })).not.toBeInTheDocument();
  });

  it('keeps effect groups independently open and only closes the clicked section on second toggle', async () => {
    renderPanel(
      buildCachedResult({
        colorEffectIds: new Set(['cat_eye']),
        artIds: new Set(['french_tip_basic']),
        decoIds: new Set(['sticker']),
      }),
    );

    const colorToggle = screen.getByRole('button', { name: /颜色效果/ });
    const artToggle = screen.getByRole('button', { name: /艺术效果/ });
    const decoToggle = screen.getByRole('button', { name: /装饰效果/ });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '猫眼色' })).toBeInTheDocument();
    });

    fireEvent.click(artToggle);
    fireEvent.click(decoToggle);

    expect(screen.getByRole('button', { name: '猫眼色' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '普通法式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '贴纸' })).toBeInTheDocument();

    // 再次点击只关闭当前 bucket，其他已展开 bucket 应保持打开。
    fireEvent.click(colorToggle);

    expect(screen.queryByRole('button', { name: '猫眼色' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '普通法式' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '贴纸' })).toBeInTheDocument();

    fireEvent.click(decoToggle);

    expect(screen.queryByRole('button', { name: '贴纸' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '普通法式' })).toBeInTheDocument();
  });
});
