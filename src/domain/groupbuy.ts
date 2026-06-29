export type GroupbuyStatus = 'draft' | 'published';

export type GroupbuyServiceSelection = {
  catalogItemId: string;
  enabled: boolean;
  quantity: number;
};

export type GroupbuyAvailability =
  | { type: 'all' }
  | { type: 'limited'; windows: Array<{ day: string; startTime: string; endTime: string }> };

export type GroupbuyDeal = {
  id: string;
  title: string;
  status: GroupbuyStatus;
  serviceSelections: GroupbuyServiceSelection[];
  originalPrice: number;
  dealPrice: number | null;
  saleStart: { type: 'afterApproval' } | { type: 'scheduled'; value: string };
  saleEnd: { type: 'autoExtend' } | { type: 'scheduled'; value: string };
  validity: { type: 'days'; days: number } | { type: 'dateRange'; start: string; end: string };
  saleChannel: 'unlimited' | 'followersOnly';
  availability: GroupbuyAvailability;
  benefitSharing: 'notStackable' | 'stackableAll' | 'stackablePartial';
  purchaseLimit: { type: 'none' } | { type: 'perUser'; quantity: number };
  createdAt: string;
  updatedAt: string;
};

export function createDefaultGroupbuyDraft(now = new Date()): GroupbuyDeal {
  const timestamp = now.toISOString();
  return {
    id: `groupbuy-${now.getTime()}`,
    title: '',
    status: 'draft',
    serviceSelections: [],
    originalPrice: 0,
    dealPrice: null,
    saleStart: { type: 'afterApproval' },
    saleEnd: { type: 'autoExtend' },
    validity: { type: 'days', days: 90 },
    saleChannel: 'unlimited',
    availability: { type: 'all' },
    benefitSharing: 'notStackable',
    purchaseLimit: { type: 'none' },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value > 0;
}

function isGroupbuyServiceSelection(value: unknown): value is GroupbuyServiceSelection {
  if (!isRecord(value)) return false;
  return (
    typeof value.catalogItemId === 'string' &&
    typeof value.enabled === 'boolean' &&
    isPositiveInteger(value.quantity)
  );
}

function isSaleStart(value: unknown): value is GroupbuyDeal['saleStart'] {
  if (!isRecord(value)) return false;
  return (
    value.type === 'afterApproval' ||
    (value.type === 'scheduled' && typeof value.value === 'string')
  );
}

function isSaleEnd(value: unknown): value is GroupbuyDeal['saleEnd'] {
  if (!isRecord(value)) return false;
  return (
    value.type === 'autoExtend' ||
    (value.type === 'scheduled' && typeof value.value === 'string')
  );
}

function isValidity(value: unknown): value is GroupbuyDeal['validity'] {
  if (!isRecord(value)) return false;
  return (
    (value.type === 'days' && isPositiveInteger(value.days)) ||
    (value.type === 'dateRange' &&
      typeof value.start === 'string' &&
      typeof value.end === 'string')
  );
}

function isAvailabilityWindow(value: unknown): value is { day: string; startTime: string; endTime: string } {
  if (!isRecord(value)) return false;
  return (
    typeof value.day === 'string' &&
    typeof value.startTime === 'string' &&
    typeof value.endTime === 'string'
  );
}

function isGroupbuyAvailability(value: unknown): value is GroupbuyAvailability {
  if (!isRecord(value)) return false;
  return (
    value.type === 'all' ||
    (value.type === 'limited' &&
      Array.isArray(value.windows) &&
      value.windows.every(isAvailabilityWindow))
  );
}

function isPurchaseLimit(value: unknown): value is GroupbuyDeal['purchaseLimit'] {
  if (!isRecord(value)) return false;
  return (
    value.type === 'none' ||
    (value.type === 'perUser' && isPositiveInteger(value.quantity))
  );
}

export function isValidGroupbuyDeal(value: unknown): value is GroupbuyDeal {
  if (!isRecord(value)) return false;
  const row = value;
  return (
    typeof row.id === 'string' &&
    typeof row.title === 'string' &&
    (row.status === 'draft' || row.status === 'published') &&
    Array.isArray(row.serviceSelections) &&
    row.serviceSelections.every(isGroupbuyServiceSelection) &&
    isNonNegativeFiniteNumber(row.originalPrice) &&
    (isNonNegativeFiniteNumber(row.dealPrice) || row.dealPrice === null) &&
    isSaleStart(row.saleStart) &&
    isSaleEnd(row.saleEnd) &&
    isValidity(row.validity) &&
    (row.saleChannel === 'unlimited' || row.saleChannel === 'followersOnly') &&
    isGroupbuyAvailability(row.availability) &&
    (row.benefitSharing === 'notStackable' ||
      row.benefitSharing === 'stackableAll' ||
      row.benefitSharing === 'stackablePartial') &&
    isPurchaseLimit(row.purchaseLimit) &&
    typeof row.createdAt === 'string' &&
    typeof row.updatedAt === 'string'
  );
}
