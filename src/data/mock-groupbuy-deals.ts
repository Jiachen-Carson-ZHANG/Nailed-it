import type { GroupbuyDeal } from '@/domain/groupbuy';

export type MockGroupbuyMeta = {
  purchaseCount: number;
  redemptionCount: number;
};

export type MockGroupbuyEntry = {
  deal: GroupbuyDeal;
  meta: MockGroupbuyMeta;
};

const MOCK_CREATED_AT = '2026-01-01T00:00:00.000Z';

export const mockGroupbuyEntries: MockGroupbuyEntry[] = [
  {
    deal: {
      id: 'deal-001',
      title: '韩系裸粉猫眼通勤款',
      status: 'published',
      serviceSelections: [
        { catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 },
        { catalogItemId: 'cat_eye', enabled: true, quantity: 10 },
        { catalogItemId: 'aura_blush', enabled: true, quantity: 5 },
        { catalogItemId: 'solid_color', enabled: true, quantity: 1 },
      ],
      originalPrice: 48,
      dealPrice: 39,
      saleStart: { type: 'afterApproval' },
      saleEnd: { type: 'autoExtend' },
      validity: { type: 'days', days: 90 },
      saleChannel: 'unlimited',
      availability: { type: 'all' },
      benefitSharing: 'notStackable',
      purchaseLimit: { type: 'none' },
      createdAt: MOCK_CREATED_AT,
      updatedAt: MOCK_CREATED_AT,
    },
    meta: { purchaseCount: 142, redemptionCount: 89 },
  },
  {
    deal: {
      id: 'deal-002',
      title: '冰透极光魔镜款',
      status: 'published',
      serviceSelections: [
        { catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 },
        { catalogItemId: 'magnetic_special_effect', enabled: true, quantity: 10 },
        { catalogItemId: 'aurora_powder', enabled: true, quantity: 10 },
        { catalogItemId: 'gradient', enabled: true, quantity: 1 },
      ],
      originalPrice: 68,
      dealPrice: 55,
      saleStart: { type: 'afterApproval' },
      saleEnd: { type: 'autoExtend' },
      validity: { type: 'days', days: 60 },
      saleChannel: 'unlimited',
      availability: { type: 'all' },
      benefitSharing: 'stackableAll',
      purchaseLimit: { type: 'perUser', quantity: 2 },
      createdAt: MOCK_CREATED_AT,
      updatedAt: MOCK_CREATED_AT,
    },
    meta: { purchaseCount: 98, redemptionCount: 61 },
  },
  {
    deal: {
      id: 'deal-003',
      title: '法式珍珠新娘款',
      status: 'published',
      serviceSelections: [
        { catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 },
        { catalogItemId: 'french_tip_basic', enabled: true, quantity: 1 },
        { catalogItemId: 'pearl', enabled: true, quantity: 5 },
        { catalogItemId: 'glitter', enabled: true, quantity: 1 },
      ],
      originalPrice: 63,
      dealPrice: 49,
      saleStart: { type: 'afterApproval' },
      saleEnd: { type: 'autoExtend' },
      validity: { type: 'days', days: 90 },
      saleChannel: 'followersOnly',
      availability: { type: 'all' },
      benefitSharing: 'notStackable',
      purchaseLimit: { type: 'none' },
      createdAt: MOCK_CREATED_AT,
      updatedAt: MOCK_CREATED_AT,
    },
    meta: { purchaseCount: 76, redemptionCount: 44 },
  },
  {
    deal: {
      id: 'deal-004',
      title: 'Y2K蝴蝶结重钻派对款',
      status: 'published',
      serviceSelections: [
        { catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 },
        { catalogItemId: 'nail_tip_full_cover', enabled: true, quantity: 1 },
        { catalogItemId: 'bow_charm', enabled: true, quantity: 3 },
        { catalogItemId: 'rhinestone_heavy', enabled: true, quantity: 10 },
      ],
      originalPrice: 123,
      dealPrice: 99,
      saleStart: { type: 'afterApproval' },
      saleEnd: { type: 'autoExtend' },
      validity: { type: 'days', days: 30 },
      saleChannel: 'unlimited',
      availability: { type: 'all' },
      benefitSharing: 'notStackable',
      purchaseLimit: { type: 'perUser', quantity: 1 },
      createdAt: MOCK_CREATED_AT,
      updatedAt: MOCK_CREATED_AT,
    },
    meta: { purchaseCount: 53, redemptionCount: 27 },
  },
  {
    deal: {
      id: 'deal-005',
      title: '度假贝壳水墨晕染款',
      status: 'published',
      serviceSelections: [
        { catalogItemId: 'basic_manicure_service', enabled: true, quantity: 1 },
        { catalogItemId: 'ink_wash', enabled: true, quantity: 1 },
        { catalogItemId: 'shell_piece', enabled: true, quantity: 5 },
        { catalogItemId: 'foil_piece', enabled: true, quantity: 3 },
      ],
      originalPrice: 78,
      dealPrice: 62,
      saleStart: { type: 'afterApproval' },
      saleEnd: { type: 'autoExtend' },
      validity: { type: 'days', days: 90 },
      saleChannel: 'unlimited',
      availability: { type: 'all' },
      benefitSharing: 'stackablePartial',
      purchaseLimit: { type: 'none' },
      createdAt: MOCK_CREATED_AT,
      updatedAt: MOCK_CREATED_AT,
    },
    meta: { purchaseCount: 34, redemptionCount: 18 },
  },
];

export const mockGroupbuyDealsById = new Map<string, MockGroupbuyEntry>(
  mockGroupbuyEntries.map((entry) => [entry.deal.id, entry])
);
