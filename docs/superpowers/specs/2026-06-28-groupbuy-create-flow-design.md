# Add Groupbuy Create Flow Design

## Context

The merchant manage page already has a right-side panel layout in `src/app/merchant/manage/page.tsx`.
`GroupbuyPanel` is wired into that panel and currently shows a mock AI card, mock groupbuy list, and a
`+ 添加团购` entry point.

The pricing source of truth for this flow is the merchant's current price list settings:

- `settingsById` from `MerchantManagePage`
- catalog metadata from `src/data/glossary.ts`
- pricing units from `src/domain/catalog.ts`

The new flow should stay inside the manage page's right-side area. It should not navigate away from
`/merchant/manage`.

## Product Goal

Let merchants create a groupbuy in two steps:

1. Choose the groupbuy name and service contents.
2. Set discount price, sale timing, validity, sale channel, availability, benefit sharing, and purchase limits.

Drafts and published groupbuys are stored locally for this iteration and shown in the groupbuy list.
The structure should be close enough to a future backend model that the storage layer can later be
replaced without rewriting the UI.

## Data Model

Add a groupbuy domain model, separate from the view component:

```ts
type GroupbuyStatus = 'draft' | 'published';

type GroupbuyServiceSelection = {
  catalogItemId: string;
  enabled: boolean;
  quantity: number;
};

type GroupbuyAvailability =
  | { type: 'all' }
  | { type: 'limited'; windows: Array<{ day: string; startTime: string; endTime: string }> };

type GroupbuyDeal = {
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
```

Use the existing currency setting only for display. Store numeric prices in the currently displayed
currency unit, matching the existing `GlossaryEntrySettings.price` convention.

## Local Repository

Create a small local repository layer instead of writing `localStorage` calls in `GroupbuyPanel`.

Responsibilities:

- `listGroupbuyDeals()`
- `saveGroupbuyDraft(input)`
- `publishGroupbuyDeal(input)`
- serialize and validate stored rows
- return locally saved draft and published deals before the existing mock deals, so newly created
  deals are immediately visible without removing the current demo content

This keeps the UI close to a future server action/repository shape.

## UI Flow

`GroupbuyPanel` owns the top-level mode:

- `list`: existing AI card, existing groupbuy list, add button
- `create`: two-step creation wizard

Clicking `+ 添加团购` switches to `create`.

The create view appears in the same `manage-main` right-side area. Its top bar includes:

- a back control
- step tabs: `团购内容`, `价格时间`

The active step is highlighted. Step 2 is reachable after Step 1 has a valid title. Publishing still
requires at least one selected service; saving may persist an incomplete draft.

Back behavior:

- if there are no unsaved changes, return to groupbuy list
- if there are unsaved changes, ask the merchant to choose:
  - save draft and return
  - discard and return
  - continue editing

## Step 1: Groupbuy Content

Fields:

- `团购名称`: text input, 1-20 Chinese/English characters by JavaScript string length.
- `服务内容`: grouped catalog selector.

Service groups:

- `基础服务`
  - single checkbox for `basic_manicure_service`
  - optional
- `卸甲`
  - expandable
  - `removal_basic_gel`
  - `removal_extension`
  - `removal_with_rhinestone`
  - optional
- `建构/延长`
  - expandable
  - `nail_tip_full_cover`
  - `nail_tip_half_cover`
  - `nail_tip_shallow_cover`
  - `builder_gel`
  - multi-select
- `颜色效果`
  - expandable
  - use the existing color effect ids from the manage page
  - each row has a toggle and quantity input
  - optional, multi-select
- `艺术效果`
  - expandable
  - use the existing art effect ids from the manage page
  - each row has a toggle and quantity input
  - optional, multi-select
- `装饰效果`
  - expandable
  - use the existing decoration ids from the manage page
  - each row has a toggle and quantity input
  - optional, multi-select

Footer actions:

- `保存`: persists a draft
- `下一步`: validates Step 1 and moves to Step 2

## Step 2: Price and Time

Fields:

- `当前服务原价`: calculated from Step 1 selections
- `设置价格`: numeric input, required before publish, must be greater than 0 and less than original price
- `售卖开始时间`
  - `审核通过立即售卖`
  - `设置售卖开始时间`
- `售卖结束时间`
  - `自动延期保持售卖`
  - `设置售卖结束时间`
- `售卖渠道`
  - `不限制`
  - `已关注我的粉丝`
- `团购使用有效期`
  - `指定天数内有效`
  - `指定时间段内有效`
  - default: 90 days
- `可用时段`
  - `全部时间可用`
  - `限制时间`
- `优惠同享信息`
  - `团购不可与其他优惠同享`
  - `团购可与全部优惠同享`
  - `团购只可与部分优惠同享`
- `单人购买量限制`
  - `不限制`
  - `设置单人购买数量上限`

Footer actions:

- `上一步`
- `保存`
- `发布`

## Price Calculation

Use the same pricing-unit semantics as the quote service:

- `per_finger` and `per_piece`: line price is `unit price * quantity`
- `per_set`, `fixed`, `included`, `tag_only`: line price is counted once

Rules:

- only enabled selected items contribute to original price
- disabled or missing-price items are not selectable, or show as unavailable
- quantity minimum is 1
- quantity maximum is 10 for per-finger items
- quantity maximum is 99 for per-piece items
- non-scaling units still keep a quantity value for display, but price is counted once

## Error Handling

Validation messages should be inline and short:

- groupbuy name is required
- groupbuy name cannot exceed 20 characters
- at least one service should be selected before publishing
- deal price is required before publishing
- deal price must be lower than original price
- sale end must be after sale start when both are scheduled
- date-range validity end must be after start

Save failures from local storage should show a toast and keep the user in the wizard.

## Testing

Add focused component/unit tests for:

- clicking `+ 添加团购` opens the wizard
- step tabs highlight the active step
- Step 1 validates title length
- original price is calculated from selected price-list items
- quantity only scales `per_finger` and `per_piece` pricing
- saving creates a draft and returns it to the list
- publishing creates a published deal and returns it to the list
- back with dirty form offers save draft, discard, and continue editing
- deal price must be lower than original price

## Non-Goals

- no database schema or Supabase persistence in this iteration
- no customer-facing purchase or redemption flow
- no editing existing published groupbuys beyond displaying locally saved rows
- no AI-generated groupbuy suggestions beyond the existing mock AI card
