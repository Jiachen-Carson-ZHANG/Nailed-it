import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
