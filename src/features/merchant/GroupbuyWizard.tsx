'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import type { GlossaryEntrySettings } from '@/data/glossary-settings-store';
import { glossaryById } from '@/data/glossary';
import { calculateGroupbuyOriginalPrice } from '@/domain/groupbuy-pricing';
import type { GroupbuyDeal, GroupbuyServiceSelection } from '@/domain/groupbuy';
import { createDefaultGroupbuyDraft } from '@/domain/groupbuy';
import { SERVICE_GROUPS } from '@/domain/groupbuy-service-groups';
import type { ServiceGroupId } from '@/domain/groupbuy-service-groups';

type GroupbuyWizardProps = {
  language: 'zh-CN' | 'en';
  currency: string;
  settingsById: Map<string, GlossaryEntrySettings>;
  initialDeal?: GroupbuyDeal;
  onCancel: () => void;
  onSaveDraft: (deal: GroupbuyDeal) => void;
  onPublish: (deal: GroupbuyDeal) => void;
};

function isPricedItem(id: string, settingsById: Map<string, GlossaryEntrySettings>): boolean {
  const setting = settingsById.get(id);
  return !!setting && setting.enabled && setting.price > 0;
}

function itemName(id: string, language: 'zh-CN' | 'en'): string {
  const entry = glossaryById.get(id);
  if (!entry) return id;
  return language === 'zh-CN' ? entry.name_zh : entry.name_en;
}

export function GroupbuyWizard({
  language,
  currency,
  settingsById,
  initialDeal,
  onCancel,
  onSaveDraft,
  onPublish,
}: GroupbuyWizardProps) {
  const [step, setStep] = useState<'content' | 'pricing'>('content');
  const [draft, setDraft] = useState<GroupbuyDeal>(() => initialDeal ?? createDefaultGroupbuyDraft());
  const [nameError, setNameError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [confirmBack, setConfirmBack] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<ServiceGroupId | null>(null);

  const visibleServiceGroups = useMemo(
    () =>
      SERVICE_GROUPS.map((group) => ({
        ...group,
        pricedIds: group.ids.filter((id) => isPricedItem(id, settingsById)),
      })).filter((group) => group.pricedIds.length > 0),
    [settingsById]
  );

  function toggleServiceGroup(groupId: ServiceGroupId) {
    setOpenGroupId((current) => (current === groupId ? null : groupId));
  }

  const price = useMemo(
    () => calculateGroupbuyOriginalPrice({ selections: draft.serviceSelections, settingsById }),
    [draft.serviceSelections, settingsById]
  );

  function withCurrentPrice(next: GroupbuyDeal): GroupbuyDeal {
    const nextPrice = calculateGroupbuyOriginalPrice({
      selections: next.serviceSelections,
      settingsById,
    });
    return { ...next, originalPrice: nextPrice.total };
  }

  function updateDraft(next: GroupbuyDeal) {
    setDraft(withCurrentPrice(next));
    setDirty(true);
  }

  function validateName() {
    const trimmed = draft.title.trim();
    if (!trimmed) {
      setNameError('请输入团购名称');
      return false;
    }
    if (trimmed.length > 20) {
      setNameError('团购名称不能超过20个字');
      return false;
    }
    setNameError('');
    return true;
  }

  function toggleSelection(catalogItemId: string, enabled: boolean) {
    const existing = draft.serviceSelections.find((selection) => selection.catalogItemId === catalogItemId);
    const nextSelection: GroupbuyServiceSelection = {
      catalogItemId,
      enabled,
      quantity: existing?.quantity ?? 1,
    };
    const rest = draft.serviceSelections.filter((selection) => selection.catalogItemId !== catalogItemId);
    updateDraft({ ...draft, serviceSelections: [nextSelection, ...rest] });
  }

  function setQuantity(catalogItemId: string, quantity: number) {
    updateDraft({
      ...draft,
      serviceSelections: draft.serviceSelections.map((selection) =>
        selection.catalogItemId === catalogItemId
          ? { ...selection, quantity: Math.max(1, Math.floor(quantity) || 1) }
          : selection
      ),
    });
  }

  function handleNext() {
    if (!validateName()) return;
    setStep('pricing');
  }

  function handleSaveDraft() {
    if (!validateName()) {
      setStep('content');
      setConfirmBack(false);
      return;
    }
    onSaveDraft({ ...withCurrentPrice(draft), status: 'draft' });
  }

  function handlePublish() {
    if (!validateName()) {
      setStep('content');
      return;
    }
    const currentDraft = withCurrentPrice(draft);
    if (currentDraft.originalPrice <= 0) {
      setPriceError('请至少选择一个服务内容');
      return;
    }
    if (
      currentDraft.dealPrice == null ||
      currentDraft.dealPrice <= 0 ||
      currentDraft.dealPrice >= currentDraft.originalPrice
    ) {
      setPriceError('团购价格必须小于当前服务原价');
      return;
    }
    setPriceError('');
    onPublish({ ...currentDraft, status: 'published' });
  }

  return (
    <div className="groupbuy-wizard">
      <div className="groupbuy-wizard-topbar">
        <button type="button" className="groupbuy-back-btn" onClick={() => (dirty ? setConfirmBack(true) : onCancel())}>
          返回
        </button>
        <div className="groupbuy-step-tabs" role="tablist" aria-label="添加团购步骤">
          <button type="button" role="tab" aria-selected={step === 'content'} onClick={() => setStep('content')}>
            团购内容
          </button>
          <button type="button" role="tab" aria-selected={step === 'pricing'} onClick={handleNext}>
            价格时间
          </button>
        </div>
      </div>

      {step === 'content' ? (
        <div className="groupbuy-step-panel">
          <label className="groupbuy-field">
            <span>团购名称</span>
            <input
              aria-label="团购名称"
              value={draft.title}
              maxLength={24}
              onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
            />
          </label>
          {nameError ? <p className="groupbuy-error">{nameError}</p> : null}

          <div className="groupbuy-field">
            <span>服务内容</span>
          </div>

          <div className="groupbuy-service-groups">
            {visibleServiceGroups.map((group) => {
              const isOpen = openGroupId === group.id;
              return (
                <section key={group.id} className="groupbuy-service-accordion">
                  <button
                    type="button"
                    className="groupbuy-service-accordion-header"
                    aria-expanded={isOpen}
                    onClick={() => toggleServiceGroup(group.id)}
                  >
                    <span>{group.label}</span>
                    <span className="groupbuy-service-accordion-chevron" aria-hidden="true">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="groupbuy-service-accordion-body">
                      {group.pricedIds.map((id) => {
                        const selection = draft.serviceSelections.find((row) => row.catalogItemId === id);
                        const setting = settingsById.get(id)!;
                        return (
                          <div key={id} className="groupbuy-service-row">
                            <label>
                              <input
                                type="checkbox"
                                checked={selection?.enabled ?? false}
                                onChange={(event) => toggleSelection(id, event.target.checked)}
                              />
                              <span>{itemName(id, language)}</span>
                            </label>
                            <span>{`${setting.price} ${currency}`}</span>
                            {group.quantity && selection?.enabled ? (
                              <input
                                aria-label={`${itemName(id, language)} 数量`}
                                type="number"
                                min={1}
                                value={selection.quantity}
                                onChange={(event) => setQuantity(id, Number(event.target.value))}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>

          <div className="groupbuy-wizard-footer">
            <Button variant="secondary" onClick={handleSaveDraft}>保存</Button>
            <Button onClick={handleNext}>下一步</Button>
          </div>
        </div>
      ) : (
        <div className="groupbuy-step-panel">
          <p className="groupbuy-original-price">当前服务原价：{price.total.toFixed(2)} {currency}</p>
          <label className="groupbuy-field">
            <span>设置价格</span>
            <input
              aria-label="设置价格"
              type="number"
              min={0}
              value={draft.dealPrice ?? ''}
              onChange={(event) => updateDraft({ ...draft, dealPrice: Number(event.target.value) || null })}
            />
          </label>
          {priceError ? <p className="groupbuy-error">{priceError}</p> : null}

          <div className="groupbuy-form-section" aria-label="价格时间设置">
            <fieldset>
              <legend>售卖开始时间</legend>
              <label>
                <input
                  type="radio"
                  name="groupbuy-sale-start"
                  checked={draft.saleStart.type === 'afterApproval'}
                  onChange={() => updateDraft({ ...draft, saleStart: { type: 'afterApproval' } })}
                />
                审核通过立即售卖
              </label>
              <label>
                <input
                  type="radio"
                  name="groupbuy-sale-start"
                  checked={draft.saleStart.type === 'scheduled'}
                  onChange={() => updateDraft({ ...draft, saleStart: { type: 'scheduled', value: '' } })}
                />
                设置售卖开始时间
              </label>
              {draft.saleStart.type === 'scheduled' ? (
                <input
                  aria-label="售卖开始时间"
                  type="datetime-local"
                  value={draft.saleStart.value}
                  onChange={(event) =>
                    updateDraft({ ...draft, saleStart: { type: 'scheduled', value: event.target.value } })}
                />
              ) : null}
            </fieldset>

            <fieldset>
              <legend>售卖结束时间</legend>
              <label>
                <input
                  type="radio"
                  name="groupbuy-sale-end"
                  checked={draft.saleEnd.type === 'autoExtend'}
                  onChange={() => updateDraft({ ...draft, saleEnd: { type: 'autoExtend' } })}
                />
                自动延期保持售卖
              </label>
              <label>
                <input
                  type="radio"
                  name="groupbuy-sale-end"
                  checked={draft.saleEnd.type === 'scheduled'}
                  onChange={() => updateDraft({ ...draft, saleEnd: { type: 'scheduled', value: '' } })}
                />
                设置售卖结束时间
              </label>
              {draft.saleEnd.type === 'scheduled' ? (
                <input
                  aria-label="售卖结束时间"
                  type="datetime-local"
                  value={draft.saleEnd.value}
                  onChange={(event) =>
                    updateDraft({ ...draft, saleEnd: { type: 'scheduled', value: event.target.value } })}
                />
              ) : null}
            </fieldset>

            <fieldset>
              <legend>售卖渠道</legend>
              <label>
                <input
                  type="radio"
                  name="groupbuy-sale-channel"
                  checked={draft.saleChannel === 'unlimited'}
                  onChange={() => updateDraft({ ...draft, saleChannel: 'unlimited' })}
                />
                不限制
              </label>
              <label>
                <input
                  type="radio"
                  name="groupbuy-sale-channel"
                  checked={draft.saleChannel === 'followersOnly'}
                  onChange={() => updateDraft({ ...draft, saleChannel: 'followersOnly' })}
                />
                已关注我的粉丝
              </label>
            </fieldset>

            <fieldset>
              <legend>团购使用有效期</legend>
              <label>
                <input
                  type="radio"
                  name="groupbuy-validity"
                  checked={draft.validity.type === 'days'}
                  onChange={() => updateDraft({ ...draft, validity: { type: 'days', days: 90 } })}
                />
                指定天数内有效
              </label>
              {draft.validity.type === 'days' ? (
                <label>
                  <input
                    aria-label="有效天数"
                    type="number"
                    min={1}
                    value={draft.validity.days}
                    onChange={(event) =>
                      updateDraft({
                        ...draft,
                        validity: { type: 'days', days: Math.max(1, Math.floor(Number(event.target.value)) || 1) },
                      })}
                  />
                  天内有效
                </label>
              ) : null}
              <label>
                <input
                  type="radio"
                  name="groupbuy-validity"
                  checked={draft.validity.type === 'dateRange'}
                  onChange={() => updateDraft({ ...draft, validity: { type: 'dateRange', start: '', end: '' } })}
                />
                设置有效日期范围
              </label>
              {draft.validity.type === 'dateRange' ? (
                <div className="groupbuy-date-range">
                  <input
                    aria-label="有效期开始日期"
                    type="date"
                    value={draft.validity.start}
                    onChange={(event) =>
                      updateDraft({
                        ...draft,
                        validity: {
                          type: 'dateRange',
                          start: event.target.value,
                          end: draft.validity.type === 'dateRange' ? draft.validity.end : '',
                        },
                      })}
                  />
                  <input
                    aria-label="有效期结束日期"
                    type="date"
                    value={draft.validity.end}
                    onChange={(event) =>
                      updateDraft({
                        ...draft,
                        validity: {
                          type: 'dateRange',
                          start: draft.validity.type === 'dateRange' ? draft.validity.start : '',
                          end: event.target.value,
                        },
                      })}
                  />
                </div>
              ) : null}
            </fieldset>

            <fieldset>
              <legend>可用时段</legend>
              <label>
                <input
                  type="radio"
                  name="groupbuy-availability"
                  checked={draft.availability.type === 'all'}
                  onChange={() => updateDraft({ ...draft, availability: { type: 'all' } })}
                />
                全部时间可用
              </label>
              <label>
                <input
                  type="radio"
                  name="groupbuy-availability"
                  checked={draft.availability.type === 'limited'}
                  onChange={() => updateDraft({ ...draft, availability: { type: 'limited', windows: [] } })}
                />
                限制时间
              </label>
              {draft.availability.type === 'limited' ? (
                <p className="groupbuy-helper-text">选择后可在后续版本中配置每周可用时段。</p>
              ) : null}
            </fieldset>

            <fieldset>
              <legend>优惠同享信息</legend>
              <label>
                <input
                  type="radio"
                  name="groupbuy-benefit-sharing"
                  checked={draft.benefitSharing === 'notStackable'}
                  onChange={() => updateDraft({ ...draft, benefitSharing: 'notStackable' })}
                />
                团购不可与其他优惠同享
              </label>
              <label>
                <input
                  type="radio"
                  name="groupbuy-benefit-sharing"
                  checked={draft.benefitSharing === 'stackableAll'}
                  onChange={() => updateDraft({ ...draft, benefitSharing: 'stackableAll' })}
                />
                可与全部优惠同享
              </label>
              <label>
                <input
                  type="radio"
                  name="groupbuy-benefit-sharing"
                  checked={draft.benefitSharing === 'stackablePartial'}
                  onChange={() => updateDraft({ ...draft, benefitSharing: 'stackablePartial' })}
                />
                仅可与部分优惠同享
              </label>
            </fieldset>

            <fieldset>
              <legend>单人购买量限制</legend>
              <label>
                <input
                  type="radio"
                  name="groupbuy-purchase-limit"
                  checked={draft.purchaseLimit.type === 'none'}
                  onChange={() => updateDraft({ ...draft, purchaseLimit: { type: 'none' } })}
                />
                不限制购买数量
              </label>
              <label>
                <input
                  type="radio"
                  name="groupbuy-purchase-limit"
                  checked={draft.purchaseLimit.type === 'perUser'}
                  onChange={() => updateDraft({ ...draft, purchaseLimit: { type: 'perUser', quantity: 1 } })}
                />
                限制每人购买数量
              </label>
              {draft.purchaseLimit.type === 'perUser' ? (
                <label>
                  <input
                    aria-label="每人限购数量"
                    type="number"
                    min={1}
                    value={draft.purchaseLimit.quantity}
                    onChange={(event) =>
                      updateDraft({
                        ...draft,
                        purchaseLimit: {
                          type: 'perUser',
                          quantity: Math.max(1, Math.floor(Number(event.target.value)) || 1),
                        },
                      })}
                  />
                  份
                </label>
              ) : null}
            </fieldset>
          </div>

          <div className="groupbuy-wizard-footer">
            <Button variant="secondary" onClick={() => setStep('content')}>上一步</Button>
            <Button variant="secondary" onClick={handleSaveDraft}>保存</Button>
            <Button onClick={handlePublish}>发布</Button>
          </div>
        </div>
      )}

      <Dialog
        open={confirmBack}
        onOpenChange={setConfirmBack}
        title="是否保存草稿？"
        description="保存当前团购草稿，或放弃更改返回列表。"
      >
        <div className="groupbuy-back-dialog-actions">
          <Button onClick={handleSaveDraft}>保存草稿暂不发布</Button>
          <Button variant="secondary" onClick={onCancel}>放弃</Button>
          <Button variant="ghost" onClick={() => setConfirmBack(false)}>继续编辑</Button>
        </div>
      </Dialog>
    </div>
  );
}
