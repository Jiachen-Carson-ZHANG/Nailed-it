'use client';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { getRepositories, resetRepositoriesForTests } from '@/lib/repositories';
import { createDefaultGroupbuyDraft, toGroupbuyRecord } from '@/domain/groupbuy';
import { demoMerchantId } from '@/mock/merchants';
import MerchantManagePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/merchant/manage'
}));

vi.mock('@/components/ui/Toast', () => ({
  Toast: ({ message }: { message: string }) => message ? <div role="status">{message}</div> : null,
}));

describe('MerchantManagePage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  function renderManagePage(language: 'zh-CN' | 'en' = 'zh-CN') {
    return render(
      <LanguageProvider initialLanguage={language} role="merchant">
        <MerchantManagePage />
      </LanguageProvider>
    );
  }

  async function openAddGroupbuyWizard() {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);
    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
  }

  function getServiceGroupsContainer() {
    const stepPanel = screen.getByText('服务内容').closest('.groupbuy-step-panel');
    const container = stepPanel?.querySelector('.groupbuy-service-groups');
    if (!container) {
      throw new Error('Service groups container not found');
    }
    return container as HTMLElement;
  }

  function expandServiceGroup(groupLabel: string) {
    const container = getServiceGroupsContainer();
    fireEvent.click(within(container).getByRole('button', { name: groupLabel }));
  }

  function selectBasicManicureService() {
    expandServiceGroup('基础服务');
    fireEvent.click(screen.getByLabelText(/基础护理服务/));
  }

  it('renders the pricing panels and saves changes to the DB', async () => {
    renderManagePage();

    expect(screen.queryByText('价格与团队')).not.toBeInTheDocument();

    // Default panel renders.
    expect(screen.getByRole('heading', { name: '基础服务' })).toBeInTheDocument();

    // Edit the base service price, then save from the preview panel (prices persist to merchant_pricing).
    const priceInput = await screen.findByLabelText(/基础护理服务 单价/i);
    fireEvent.change(priceInput, { target: { value: '12' } });

    fireEvent.click(screen.getByRole('button', { name: '价目表' }));
    fireEvent.click(screen.getByRole('button', { name: /保存价格表/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/价格表已更新/i);
  });

  it('renders merchant manage copy in English', async () => {
    renderManagePage('en');

    expect(screen.queryByText('Pricing and team')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic services' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Price list' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Group buying' })).toBeInTheDocument();
    expect(await screen.findByLabelText(/Basic manicure service price/i)).toBeInTheDocument();
  });

  it('opens the add groupbuy wizard from the groupbuy panel', async () => {
    await openAddGroupbuyWizard();

    expect(screen.getByRole('button', { name: /返回/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '团购内容' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '价格时间' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText('团购名称')).toBeInTheDocument();
    expect(screen.getByText('服务内容')).toBeInTheDocument();
  });

  it('keeps service groups collapsed by default and expands on click', async () => {
    await openAddGroupbuyWizard();
    const serviceGroups = getServiceGroupsContainer();

    expect(screen.queryByLabelText(/基础护理服务/)).not.toBeInTheDocument();
    expect(within(serviceGroups).getByRole('button', { name: '基础服务' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    expandServiceGroup('基础服务');

    expect(within(serviceGroups).getByRole('button', { name: '基础服务' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByLabelText(/基础护理服务/)).toBeInTheDocument();
  });

  it('opens only one service group at a time', async () => {
    await openAddGroupbuyWizard();
    const serviceGroups = getServiceGroupsContainer();

    expandServiceGroup('基础服务');
    expect(screen.getByLabelText(/基础护理服务/)).toBeInTheDocument();

    expandServiceGroup('卸甲');
    expect(screen.queryByLabelText(/基础护理服务/)).not.toBeInTheDocument();
    expect(within(serviceGroups).getByRole('button', { name: '基础服务' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(within(serviceGroups).getByRole('button', { name: '卸甲' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('hides unpriced service rows in the groupbuy wizard', async () => {
    await openAddGroupbuyWizard();

    expect(screen.queryByText('未定价')).not.toBeInTheDocument();

    expandServiceGroup('基础服务');
    expect(screen.queryByText('未定价')).not.toBeInTheDocument();
  });

  it('validates groupbuy name before moving to price and time', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
    fireEvent.change(screen.getByLabelText('团购名称'), {
      target: { value: '超过二十个字的团购名称会被拦截因为真的太长了' },
    });
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));

    expect(screen.getByText('团购名称不能超过20个字')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '团购内容' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '价格时间' })).toHaveAttribute('aria-selected', 'false');
  });

  it('validates groupbuy name before saving a draft', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    expect(screen.getByText('请输入团购名称')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '团购内容' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('团购名称')).toBeInTheDocument();
  });

  it('keeps an invalid draft in the wizard when saving from the back dialog', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
    fireEvent.change(screen.getByLabelText('团购名称'), {
      target: { value: '超过二十个字的团购名称会被拦截因为真的太长了' },
    });
    fireEvent.click(screen.getByRole('button', { name: /返回/ }));
    fireEvent.click(screen.getByRole('button', { name: '保存草稿暂不发布' }));

    expect(screen.getByText('团购名称不能超过20个字')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /返回/ })).toBeInTheDocument();
    expect(screen.queryByText('超过二十个字的团购名称会被拦截因为真的太长了')).not.toBeInTheDocument();
  });

  it('saves a local groupbuy draft and returns it to the list', async () => {
    await openAddGroupbuyWizard();
    fireEvent.change(screen.getByLabelText('团购名称'), { target: { value: '猫眼通勤团购' } });
    selectBasicManicureService();
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    const newCard = (await screen.findByText('猫眼通勤团购')).closest('.groupbuy-deal-card') as HTMLElement;
    expect(within(newCard).getByText('草稿')).toBeInTheDocument();
    expect(within(newCard).getByText('基础护理服务')).toBeInTheDocument();
    expect(within(newCard).queryByText('basic_manicure_service')).not.toBeInTheDocument();
  });

  it('publishes a local groupbuy when price is lower than original price', async () => {
    await openAddGroupbuyWizard();
    fireEvent.change(screen.getByLabelText('团购名称'), { target: { value: '猫眼通勤团购' } });
    selectBasicManicureService();
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.change(screen.getByLabelText('设置价格'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    expect(await screen.findByText('猫眼通勤团购')).toBeInTheDocument();
    expect(screen.queryByText('草稿')).not.toBeInTheDocument();
  });

  it('requires publish price to be lower than original price', async () => {
    await openAddGroupbuyWizard();
    fireEvent.change(screen.getByLabelText('团购名称'), { target: { value: '猫眼通勤团购' } });
    selectBasicManicureService();
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.change(screen.getByLabelText('设置价格'), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: '发布' }));

    expect(screen.getByText('团购价格必须小于当前服务原价')).toBeInTheDocument();
  });

  it('asks whether to save a dirty draft before returning', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    fireEvent.click(screen.getByRole('button', { name: '+ 添加团购' }));
    fireEvent.change(screen.getByLabelText('团购名称'), { target: { value: '猫眼通勤团购' } });
    fireEvent.click(screen.getByRole('button', { name: /返回/ }));

    expect(screen.getByText('是否保存草稿？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存草稿暂不发布' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '放弃' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '继续编辑' })).toBeInTheDocument();
  });

  function getDealListContainer() {
    const list = document.querySelector('.groupbuy-deal-list');
    if (!list) throw new Error('.groupbuy-deal-list not found');
    return list as HTMLElement;
  }

  async function openFirstDealDetail() {
    // Deals now load asynchronously through the repository seam (ADR-0012), so wait for the list.
    const dealList = getDealListContainer();
    const viewButtons = await within(dealList).findAllByRole('button', { name: '查看' });
    fireEvent.click(viewButtons[0]);
  }

  it('opens detail view when clicking 查看 on a mock deal', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    await openFirstDealDetail();

    expect(screen.getByRole('button', { name: /返回/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '修改' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下架' })).toBeInTheDocument();
  });

  it('shows service content accordion in detail view collapsed by default', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    await openFirstDealDetail();

    const serviceAccordion = screen.getByRole('button', { name: /服务内容/ });
    expect(serviceAccordion).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands service content accordion and shows enabled items', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    await openFirstDealDetail();

    fireEvent.click(screen.getByRole('button', { name: /服务内容/ }));

    expect(screen.getByRole('button', { name: /服务内容/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('基础护理服务')).toBeInTheDocument();
  });

  it('returns from detail to list when clicking 返回', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    await openFirstDealDetail();
    fireEvent.click(screen.getByRole('button', { name: /返回/ }));

    expect(screen.getByRole('button', { name: '+ 添加团购' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '修改' })).not.toBeInTheDocument();
  });

  it('copies a deal and shows the copy as a draft in the list', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    await openFirstDealDetail();
    fireEvent.click(screen.getByRole('button', { name: '复制' }));

    expect(await screen.findByText(/副本/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ 添加团购' })).toBeInTheDocument();
    expect(screen.getAllByText('草稿').length).toBeGreaterThan(0);
  });

  it('unlists a deal and shows 已下架 in the list', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    await openFirstDealDetail();
    fireEvent.click(screen.getByRole('button', { name: '下架' }));

    expect(await screen.findByRole('button', { name: '上架' })).toBeInTheDocument();
  });

  it('relists a deal after unlisting it', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    await openFirstDealDetail();
    fireEvent.click(screen.getByRole('button', { name: '下架' }));
    fireEvent.click(await screen.findByRole('button', { name: '上架' }));

    expect(await screen.findByRole('button', { name: '下架' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '上架' })).not.toBeInTheDocument();
  });

  it('enters edit mode with prefilled data when clicking 修改', async () => {
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);

    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));
    await openFirstDealDetail();
    fireEvent.click(screen.getByRole('button', { name: '修改' }));

    expect(screen.getByRole('tab', { name: '团购内容' })).toBeInTheDocument();
    const nameInput = screen.getByLabelText('团购名称') as HTMLInputElement;
    expect(nameInput.value).not.toBe('');
  });
  it('surfaces an agent-proposed draft in the AI助手 card, not a hardcoded mockup (ADR-0012)', async () => {
    // A deal carrying a sourceRunId is one the 团购 agent proposed; the merchant must be able to review it.
    await getRepositories().groupbuy.save(
      toGroupbuyRecord(
        { ...createDefaultGroupbuyDraft(), id: 'gb-agent-1', title: '闲时套餐', originalPrice: 158, dealPrice: 128 },
        demoMerchantId,
        'CNY',
        'run-42',
      ),
    );
    renderManagePage();
    await screen.findByLabelText(/基础护理服务 单价/i);
    fireEvent.click(screen.getByRole('button', { name: '团购管理' }));

    expect((await screen.findAllByText(/闲时套餐/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('AI 建议').length).toBeGreaterThan(0); // the proposal is badged
  });
});
