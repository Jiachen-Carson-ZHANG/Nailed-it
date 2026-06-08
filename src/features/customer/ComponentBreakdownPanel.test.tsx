import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import {
  buildBreakdownResult,
  ComponentBreakdownPanel,
} from './ComponentBreakdownPanel';
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
}: {
  structureIds?: Set<string>;
  nailShape?: string | null;
  nailLength?: string | null;
  texture?: string | null;
  colorIds?: Set<string>;
  colorEffectIds?: Set<string>;
  artIds?: Set<string>;
  decoIds?: Set<string>;
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
    new Map(),
    settingsById,
  );
}

function expandAllVisibleAddOptionButtons() {
  for (const button of screen.getAllByRole('button', { name: '添加选项' })) {
    fireEvent.click(button);
  }
}

describe('ComponentBreakdownPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    listMerchantPricingSettingsActionMock.mockReset();
    listMerchantPricingSettingsActionMock.mockResolvedValue([]);
  });

  it('allows manually deselecting hydrated structure chips after hydration', async () => {
    renderPanel(
      buildCachedResult({
        structureIds: new Set(['nail_tip_full_cover', 'builder_gel', 'nail_tip_half_cover']),
      }),
    );

    // hydration 后的 implied 结构项仍然要保留普通 chip 行为，用户可手动取消。
    const builderGelChip = await screen.findByRole('button', { name: '建构' });
    const halfCoverTipChip = screen.getByRole('button', { name: '半贴甲片' });
    const fullCoverTipChip = screen.getByRole('button', { name: '全贴甲片' });

    expect(builderGelChip).toHaveAttribute('aria-pressed', 'true');
    expect(halfCoverTipChip).toHaveAttribute('aria-pressed', 'true');

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
        texture: 'matte_top',
        colorIds: new Set(['color_nude']),
      }),
    );

    // 新设计把旧的“甲型 / 颜色”收敛成单一“甲型”区块，只保留甲型和甲长。
    expect(screen.queryByRole('heading', { name: '甲型 / 颜色' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '甲型' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '杏仁形' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '短甲' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('质感')).not.toBeInTheDocument();
    expect(screen.queryByText('底色（可多选）')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '方形' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '长甲' })).not.toBeInTheDocument();

    // 先点亮命中项，再通过 +N 展开剩余候选，是新交互必须锁定的行为。
    expandAllVisibleAddOptionButtons();

    expect(screen.getByRole('button', { name: '方形' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '长甲' })).toBeInTheDocument();
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
