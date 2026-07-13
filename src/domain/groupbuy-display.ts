import type { GroupbuyDeal } from '@/domain/groupbuy';

export function formatSaleStart(saleStart: GroupbuyDeal['saleStart']): string {
  if (saleStart.type === 'afterApproval') return '审核通过立即售卖';
  return `${saleStart.value.replace('T', ' ')}`;
}

export function formatSaleEnd(saleEnd: GroupbuyDeal['saleEnd']): string {
  if (saleEnd.type === 'autoExtend') return '自动延期保持售卖';
  return `${saleEnd.value.replace('T', ' ')}`;
}

export function formatValidity(validity: GroupbuyDeal['validity']): string {
  if (validity.type === 'days') return `${validity.days} 天内有效`;
  return `${validity.start} 至 ${validity.end}`;
}

export function formatSaleChannel(saleChannel: GroupbuyDeal['saleChannel']): string {
  return saleChannel === 'unlimited' ? '不限制' : '已关注我的粉丝';
}

export function formatAvailability(availability: GroupbuyDeal['availability']): string {
  return availability.type === 'all' ? '全部时间可用' : '限制时间';
}

export function formatBenefitSharing(benefitSharing: GroupbuyDeal['benefitSharing']): string {
  if (benefitSharing === 'notStackable') return '团购不可与其他优惠同享';
  if (benefitSharing === 'stackableAll') return '可与全部优惠同享';
  return '仅可与部分优惠同享';
}

export function formatPurchaseLimit(purchaseLimit: GroupbuyDeal['purchaseLimit']): string {
  if (purchaseLimit.type === 'none') return '不限制购买数量';
  return `每人限购 ${purchaseLimit.quantity} 份`;
}

export function formatStatus(status: GroupbuyDeal['status']): string {
  if (status === 'draft') return '草稿';
  if (status === 'unlisted') return '已下架';
  return '已发布';
}
