import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import {
  buildBreakdownFromConfig,
  buildBreakdownFromSelections,
  ComponentBreakdownPanel,
} from './ComponentBreakdownPanel';

const { listMerchantPricingSettingsActionMock } = vi.hoisted(() => ({
  listMerchantPricingSettingsActionMock: vi.fn(),
}));

vi.mock('@/lib/actions/merchant-pricing-actions', () => ({
  listMerchantPricingSettingsAction: listMerchantPricingSettingsActionMock,
}));

function renderPanel(cachedResult = buildBreakdownFromSelections([])) {
  return render(
    <LanguageProvider initialLanguage="zh-CN" role="customer">
      <ComponentBreakdownPanel image={null} cachedResult={cachedResult} autoAnalyze={false} />
    </LanguageProvider>,
  );
}

function getSectionByHeading(name: string) {
  const heading = screen.getByRole('heading', { name });
  const section = heading.closest('.analyze-section');
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

describe('ComponentBreakdownPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    listMerchantPricingSettingsActionMock.mockReset();
    listMerchantPricingSettingsActionMock.mockResolvedValue([]);
  });

  it('renders a simplified nail shape section with only shape and length controls', () => {
    renderPanel(
      buildBreakdownFromSelections([
        { catalogItemId: 'shape_almond', quantity: 1 },
        { catalogItemId: 'length_short', quantity: 1 },
      ]),
    );

    // 新设计把旧的“甲型 / 颜色”收敛成单一“甲型”区块，只保留甲型和甲长。
    const shapeSection = getSectionByHeading('甲型');
    expect(screen.queryByRole('heading', { name: '甲型 / 颜色' })).not.toBeInTheDocument();
    expect(within(shapeSection).getByText('甲长')).toBeInTheDocument();
    expect(within(shapeSection).queryByText('质感')).not.toBeInTheDocument();
    expect(within(shapeSection).queryByText('底色（可多选）')).not.toBeInTheDocument();
    expect(within(shapeSection).getAllByRole('button', { name: /\+\s\d+/ }).length).toBeGreaterThan(0);
  });

  it('shows selected base color inside color effects instead of the old shape section', async () => {
    renderPanel(buildBreakdownFromConfig([], ['裸色']));

    const effectsSection = getSectionByHeading('款式效果');

    // 底色迁入颜色效果后，颜色效果区应直接展示已识别的底色标签。
    await waitFor(() => {
      expect(within(effectsSection).getByText('裸色')).toBeInTheDocument();
    });
  });

  it('keeps color, art, and decoration effect groups open at the same time', async () => {
    renderPanel(
      buildBreakdownFromSelections([
        { catalogItemId: 'solid_color', quantity: 1 },
        { catalogItemId: 'french_tip_basic', quantity: 1 },
        { catalogItemId: 'sticker', quantity: 1 },
      ]),
    );

    const effectsSection = getSectionByHeading('款式效果');

    await waitFor(() => {
      expect(within(effectsSection).getByText('纯色')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /艺术效果/ }));
    fireEvent.click(screen.getByRole('button', { name: /装饰效果/ }));

    expect(within(effectsSection).getByText('纯色')).toBeInTheDocument();
    expect(within(effectsSection).getByText('法式')).toBeInTheDocument();
    expect(within(effectsSection).getByText('贴纸')).toBeInTheDocument();
  });
});
