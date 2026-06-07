# Language System Rebuild Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the requested localization follow-ups for profile switcher UX, customer home, booking upload copy, message history display, merchant calendar UI, and merchant profile labeling without touching the landing page.

**Architecture:** Reuse the existing role-aware localization runtime and extend the shared UI message dictionaries for fixed chrome. Keep message-history localization at the display boundary by selecting language-appropriate seeded/system content before rendering, instead of introducing a second localization system or redesigning landing/calendar data contracts.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Testing Library

---

## File Structure

### Existing Files To Modify

- `src/features/shared/LanguageSwitcher.tsx`
  - Replace the always-open two-button row with a collapsible disclosure-style switcher.
- `src/app/customer/profile/page.tsx`
  - Move the switcher above `Privacy Policy` and keep customer-specific copy intact.
- `src/app/merchant/profile/page.tsx`
  - Move the switcher above `Privacy Policy` and rename the roster section to the new management-oriented label.
- `src/i18n/messages/ui/zh-CN.ts`
  - Add new Chinese strings for profile switcher, customer home, booking upload, messages, and merchant calendar UI.
- `src/i18n/messages/ui/en.ts`
  - Add matching English keys for the same surfaces.
- `src/components/layout/MobileLayout.tsx`
  - Reuse the updated `layout.newNailDesign` message so the top CTA shows `+上传款式` in Chinese mode.
- `src/features/customer/TrendingStylesPanel.tsx`
  - Localize trending title, subtitle, loading, refresh, and error copy.
- `src/features/customer/StyleWaterfallGridClient.tsx`
  - Localize tab names, filter bar labels, clear action, and empty state copy.
- `src/components/ui/ImageUploader.tsx`
  - Localize `Upload or take photo` and `Try on this look`.
- `src/app/customer/booking/booking-content.tsx`
  - Change the Chinese analyze CTA to `AI识别` through the shared message key path.
- `src/mock/conversations.ts`
  - Store bilingual seeded/system-visible message variants for existing history.
- `src/domain/messaging.ts`
  - Select the correct seeded/system-visible message text and booking-time display for the current language.
- `src/lib/actions/conversation-actions.ts`
  - Thread the current language from client calls into the conversation mapper.
- `src/app/customer/messages/page.tsx`
  - Request customer conversations in the current language.
- `src/app/customer/messages/[conversationId]/conversation-client.tsx`
  - Request the selected customer thread in the current language.
- `src/app/merchant/messages/page.tsx`
  - Request merchant conversations in the current language.
- `src/app/merchant/messages/[conversationId]/conversation-client.tsx`
  - Request the selected merchant thread in the current language.
- `src/app/merchant/calendar/page.tsx`
  - Localize page chrome and loading states.
- `src/features/merchant/CalendarSchedule.tsx`
  - Localize visible calendar UI copy, aria labels, tabs, legends, empty states, and helper labels.

### Tests To Modify

- `src/app/customer/profile/page.test.tsx`
- `src/app/merchant/profile/page.test.tsx`
- `src/app/customer/home/page.test.tsx`
- `src/features/customer/TrendingStylesPanel.test.tsx`
- `src/app/customer/booking/page.test.tsx`
- `src/app/customer/messages/page.test.tsx`
- `src/app/customer/messages/[conversationId]/page.test.tsx`
- `src/app/merchant/messages/page.test.tsx`
- `src/app/merchant/messages/[conversationId]/page.test.tsx`
- `src/app/merchant/calendar/page.test.tsx`

### No New Parallel Runtime

- Do **not** create a second i18n provider, route-level locale system, or landing-page localization layer.

---

### Task 1: Collapse And Reposition The Profile Language Switcher

**Files:**
- Modify: `src/features/shared/LanguageSwitcher.tsx`
- Modify: `src/app/customer/profile/page.tsx`
- Modify: `src/app/merchant/profile/page.tsx`
- Modify: `src/i18n/messages/ui/zh-CN.ts`
- Modify: `src/i18n/messages/ui/en.ts`
- Test: `src/app/customer/profile/page.test.tsx`
- Test: `src/app/merchant/profile/page.test.tsx`

- [ ] **Step 1: Write the failing profile switcher tests**

Add assertions that the switcher is now a collapsed disclosure entry above `Privacy Policy`, expands on click, and collapses after selection.

```tsx
it('shows a collapsed language switcher above Privacy Policy on customer profile', async () => {
  const user = userEvent.setup();
  renderCustomerProfilePage();

  const entry = screen.getByRole('button', { name: '语言设置' });
  const privacy = screen.getByRole('link', { name: '隐私政策' });

  expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
  expect(entry.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await user.click(entry);
  expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '中文' })).toHaveAttribute('aria-pressed', 'true');
});

it('collapses the merchant switcher after changing language', async () => {
  const user = userEvent.setup();
  renderMerchantProfilePage();

  await user.click(screen.getByRole('button', { name: '语言设置' }));
  await user.click(screen.getByRole('button', { name: 'English' }));

  expect(screen.queryByRole('button', { name: '中文' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Language' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the profile tests to verify they fail**

Run:

```bash
npm test -- 'src/app/customer/profile/page.test.tsx' 'src/app/merchant/profile/page.test.tsx'
```

Expected: FAIL because the current switcher is always open and still sits above the profile content rather than directly above `Privacy Policy`.

- [ ] **Step 3: Implement the disclosure switcher and move it**

Update the shared switcher so it owns the collapsed/expanded interaction, shows only the entry button by default, and collapses after selection. Then move the switcher block below the main profile content sections and directly above `Privacy Policy` on both profile pages.

```tsx
export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  function selectLanguage(option: AppLanguage) {
    setLanguage(option);
    setOpen(false);
  }

  return (
    <section aria-label={t('profile.language.switch')} className="profile-section">
      <button
        aria-expanded={open}
        className="button button-secondary button-block"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {language === 'zh-CN' ? t('profile.language.zh') : t('profile.language.en')}
      </button>
      {open ? (
        <div aria-label={t('profile.language.switch')} className="profile-stack" role="group">
          {languageOptions.map((option) => (
            <button
              key={option}
              aria-pressed={language === option}
              className={language === option ? 'button button-primary button-block' : 'button button-secondary button-block'}
              onClick={() => selectLanguage(option)}
              type="button"
            >
              {option === 'zh-CN' ? t('profile.language.zh') : t('profile.language.en')}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
```

And in each profile page:

```tsx
      <section className="profile-section">
        <LanguageSwitcher />
      </section>

      <Link className="button button-secondary button-block" href="/privacy">
        {copy.privacyPolicy}
      </Link>
```

- [ ] **Step 4: Run the profile tests again**

Run:

```bash
npm test -- 'src/app/customer/profile/page.test.tsx' 'src/app/merchant/profile/page.test.tsx'
```

Expected: PASS with the new disclosure interaction and placement checks.

- [ ] **Step 5: Commit the switcher task**

```bash
git add src/features/shared/LanguageSwitcher.tsx src/app/customer/profile/page.tsx src/app/merchant/profile/page.tsx src/i18n/messages/ui/zh-CN.ts src/i18n/messages/ui/en.ts src/app/customer/profile/page.test.tsx src/app/merchant/profile/page.test.tsx
git commit -m "feat: collapse profile language switcher"
```

---

### Task 2: Localize Customer Home And Booking Upload Copy

**Files:**
- Modify: `src/i18n/messages/ui/zh-CN.ts`
- Modify: `src/i18n/messages/ui/en.ts`
- Modify: `src/components/layout/MobileLayout.tsx`
- Modify: `src/features/customer/TrendingStylesPanel.tsx`
- Modify: `src/features/customer/StyleWaterfallGridClient.tsx`
- Modify: `src/components/ui/ImageUploader.tsx`
- Modify: `src/app/customer/booking/booking-content.tsx`
- Test: `src/app/customer/home/page.test.tsx`
- Test: `src/features/customer/TrendingStylesPanel.test.tsx`
- Test: `src/app/customer/booking/page.test.tsx`

- [ ] **Step 1: Write the failing home and booking copy tests**

Add customer-home assertions for `热门`, `收藏夹`, `刷新`, and `+上传款式`, then add booking-upload assertions for `上传或拍照`, `试戴款式`, and `AI识别`.

```tsx
it('renders the customer home in Chinese mode with the requested labels', async () => {
  renderCustomerHomePage('zh-CN');

  expect(screen.getByRole('link', { name: '+上传款式' })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: '热门' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '收藏夹' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument();
});

it('shows localized upload actions in Chinese mode', async () => {
  renderBookingContent(<CustomerBookingContent />, 'zh-CN');

  expect(screen.getByText('上传或拍照')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('选择美甲参考图'), { target: { files: [file] } });
  expect(await screen.findByRole('link', { name: '试戴款式' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'AI识别' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the affected home and booking tests**

Run:

```bash
npm test -- 'src/app/customer/home/page.test.tsx' 'src/features/customer/TrendingStylesPanel.test.tsx' 'src/app/customer/booking/page.test.tsx'
```

Expected: FAIL because current home and upload controls still contain the old labels.

- [ ] **Step 3: Move the requested copy into the shared messages and consume it**

Add new dictionary keys such as `home.trending.title`, `home.feed.saved`, `home.feed.refresh`, `booking.upload.chooseAction`, `booking.upload.tryOnAction`, and update `layout.newNailDesign` to the new Chinese wording.

```tsx
const tabs = [
  { key: 'Trending', label: t('home.feed.trending') },
  { key: 'Saved', label: t('home.feed.saved') },
] as const;

<Button disabled={isLoading} onClick={loadTrending} size="compact" variant="secondary">
  {isLoading ? t('home.trending.loadingAction') : t('home.trending.refresh')}
</Button>

<label className="button button-primary button-default uploader-action">
  {t('booking.upload.chooseAction')}
  <input ... />
</label>

<Link className="button button-secondary button-default uploader-action" href={tryOnHref}>
  {t('booking.upload.tryOnAction')}
</Link>
```

And in `booking-content.tsx` update the analyze CTA source key:

```tsx
<Button disabled={isAnalyzing} type="submit">
  {isAnalyzing ? t('booking.result.loading') : t('booking.result.analyzeButton')}
</Button>
```

with `booking.result.analyzeButton` changed to `AI识别` in Chinese mode.

- [ ] **Step 4: Run the home and booking tests again**

Run:

```bash
npm test -- 'src/app/customer/home/page.test.tsx' 'src/features/customer/TrendingStylesPanel.test.tsx' 'src/app/customer/booking/page.test.tsx'
```

Expected: PASS in both Chinese and English paths.

- [ ] **Step 5: Commit the home and booking task**

```bash
git add src/i18n/messages/ui/zh-CN.ts src/i18n/messages/ui/en.ts src/components/layout/MobileLayout.tsx src/features/customer/TrendingStylesPanel.tsx src/features/customer/StyleWaterfallGridClient.tsx src/components/ui/ImageUploader.tsx src/app/customer/booking/booking-content.tsx src/app/customer/home/page.test.tsx src/features/customer/TrendingStylesPanel.test.tsx src/app/customer/booking/page.test.tsx
git commit -m "feat: localize customer home and upload copy"
```

---

### Task 3: Make Existing Message History Language-Aware

**Files:**
- Modify: `src/mock/conversations.ts`
- Modify: `src/domain/messaging.ts`
- Modify: `src/lib/actions/conversation-actions.ts`
- Modify: `src/app/customer/messages/page.tsx`
- Modify: `src/app/customer/messages/[conversationId]/conversation-client.tsx`
- Modify: `src/app/merchant/messages/page.tsx`
- Modify: `src/app/merchant/messages/[conversationId]/conversation-client.tsx`
- Test: `src/app/customer/messages/page.test.tsx`
- Test: `src/app/customer/messages/[conversationId]/page.test.tsx`
- Test: `src/app/merchant/messages/page.test.tsx`
- Test: `src/app/merchant/messages/[conversationId]/page.test.tsx`

- [ ] **Step 1: Write the failing messages-history localization tests**

Add assertions that the same seeded history thread shows Chinese system text and booking time in Chinese mode, while still showing English in English mode.

```tsx
it('renders customer history in Chinese mode with Chinese system text', async () => {
  renderPage('zh-CN');

  expect(await screen.findByText('今天 14:00')).toBeInTheDocument();
  expect(screen.getByText('已确认与你和 Mei Chen 的今日 14:00 预约。')).toBeInTheDocument();
});

it('renders merchant history in English mode with English seed text', async () => {
  renderPage('en');

  expect(await screen.findByText('Tomorrow 15:30')).toBeInTheDocument();
  expect(screen.getByText('Appointment pending review for Tomorrow 15:30 with Mei Chen.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the messages tests to verify the current gap**

Run:

```bash
npm test -- 'src/app/customer/messages/page.test.tsx' 'src/app/customer/messages/[conversationId]/page.test.tsx' 'src/app/merchant/messages/page.test.tsx' 'src/app/merchant/messages/[conversationId]/page.test.tsx'
```

Expected: FAIL because history content is currently English-only.

- [ ] **Step 3: Add bilingual seeded/history display mapping**

Keep free-text user-authored messages unchanged, but add bilingual variants for seeded/system-visible content and select them in `toConversationForRole()` using the current language supplied by the client callers.

```ts
type LocalizedSeedText = {
  'zh-CN': string;
  en: string;
};

type SeedBookingMessage = Omit<BookingMessage, 'body' | 'sentAt'> & {
  body: string | LocalizedSeedText;
  sentAt: string | LocalizedSeedText;
};

type SeedConversationThread = Omit<BookingConversationThread, 'relatedBookingTime' | 'messages'> & {
  relatedBookingTime: string | LocalizedSeedText;
  messages: SeedBookingMessage[];
};

function pickSeedText(value: string | LocalizedSeedText, language: AppLanguage): string {
  return typeof value === 'string' ? value : value[language];
}
```

Then thread the language through the mapper:

```ts
export function toConversationForRole(
  thread: SeedConversationThread,
  viewerRole: UserRole,
  language: AppLanguage
): Conversation {
  const messages = thread.messages.map((message) => ({
    id: message.id,
    author: ...,
    body: pickSeedText(message.body, language),
    sentAt: pickSeedText(message.sentAt, language),
  }));

  return {
    ...,
    relatedBookingTime: pickSeedText(thread.relatedBookingTime, language),
    lastMessage: messages.at(-1)?.body ?? '',
    messages,
  };
}
```

And in the client components:

```tsx
const { language } = useLanguage();
setConversations(await listCustomerConversationsAction(language));
setConversation(await getMerchantConversationAction(conversationId, language));
```

- [ ] **Step 4: Run the messages tests again**

Run:

```bash
npm test -- 'src/app/customer/messages/page.test.tsx' 'src/app/customer/messages/[conversationId]/page.test.tsx' 'src/app/merchant/messages/page.test.tsx' 'src/app/merchant/messages/[conversationId]/page.test.tsx'
```

Expected: PASS with Chinese history in Chinese mode and English history in English mode.

- [ ] **Step 5: Commit the messages-history task**

```bash
git add src/mock/conversations.ts src/domain/messaging.ts src/lib/actions/conversation-actions.ts src/app/customer/messages/page.tsx src/app/customer/messages/[conversationId]/conversation-client.tsx src/app/merchant/messages/page.tsx src/app/merchant/messages/[conversationId]/conversation-client.tsx src/app/customer/messages/page.test.tsx src/app/customer/messages/[conversationId]/page.test.tsx src/app/merchant/messages/page.test.tsx src/app/merchant/messages/[conversationId]/page.test.tsx
git commit -m "feat: localize seeded message history"
```

---

### Task 4: Localize Merchant Calendar UI And Rename The Merchant Profile Section

**Files:**
- Modify: `src/i18n/messages/ui/zh-CN.ts`
- Modify: `src/i18n/messages/ui/en.ts`
- Modify: `src/app/merchant/calendar/page.tsx`
- Modify: `src/features/merchant/CalendarSchedule.tsx`
- Modify: `src/app/merchant/profile/page.tsx`
- Test: `src/app/merchant/calendar/page.test.tsx`
- Test: `src/app/merchant/profile/page.test.tsx`

- [ ] **Step 1: Write the failing merchant calendar and profile-label tests**

Add Chinese-mode assertions for the calendar chrome and the renamed profile section title.

```tsx
it('renders merchant calendar UI in Chinese mode', async () => {
  renderMerchantCalendarPage('zh-CN');

  expect(screen.getByText('日历')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '预约日历' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '月视图' })).toBeInTheDocument();
});

it('shows 美甲师管理 on merchant profile in Chinese mode', async () => {
  renderMerchantProfilePage();
  expect(await screen.findByText('美甲师管理')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the merchant calendar and profile tests**

Run:

```bash
npm test -- 'src/app/merchant/calendar/page.test.tsx' 'src/app/merchant/profile/page.test.tsx'
```

Expected: FAIL because current calendar and profile label copy are still English / old Chinese wording.

- [ ] **Step 3: Move merchant calendar UI strings into the shared messages**

Localize page title, subtitle, date picker aria labels, month/day tabs, legend states, empty state, and pending badge text. Also rename the profile title prop source to `美甲师管理` in Chinese mode and a management-oriented English label.

```tsx
const { language, t } = useLanguage();

<section className="page-heading">
  <p className="section-eyebrow">{t('calendar.eyebrow')}</p>
  <h1>{t('calendar.title')}</h1>
</section>

<button role="tab" ...>
  {t('calendar.view.month')}
</button>

<span className="cal-spot-left">
  {left <= 0 ? t('calendar.capacity.full') : t('calendar.capacity.left', { count: left })}
</span>

{pending ? <span className="cal-appt-flag">{t('calendar.booking.confirm')}</span> : null}
```

And in merchant profile:

```tsx
const merchantProfileCopy = {
  'zh-CN': {
    ...,
    technicianWorkload: '美甲师管理',
  },
  en: {
    ...,
    technicianWorkload: 'Technician management',
  },
} as const;
```

- [ ] **Step 4: Run the merchant calendar and profile tests again**

Run:

```bash
npm test -- 'src/app/merchant/calendar/page.test.tsx' 'src/app/merchant/profile/page.test.tsx'
```

Expected: PASS with localized calendar chrome and the updated profile section label.

- [ ] **Step 5: Commit the merchant calendar task**

```bash
git add src/i18n/messages/ui/zh-CN.ts src/i18n/messages/ui/en.ts src/app/merchant/calendar/page.tsx src/features/merchant/CalendarSchedule.tsx src/app/merchant/profile/page.tsx src/app/merchant/calendar/page.test.tsx src/app/merchant/profile/page.test.tsx
git commit -m "feat: localize merchant calendar ui"
```

---

### Task 5: Run Full Regression And Confirm Scope Boundaries

**Files:**
- Modify: `docs/superpowers/plans/2026-06-07-language-system-rebuild-followups.md`
- Test: `src/app/customer/profile/page.test.tsx`
- Test: `src/app/merchant/profile/page.test.tsx`
- Test: `src/app/customer/home/page.test.tsx`
- Test: `src/features/customer/TrendingStylesPanel.test.tsx`
- Test: `src/app/customer/booking/page.test.tsx`
- Test: `src/app/customer/messages/page.test.tsx`
- Test: `src/app/customer/messages/[conversationId]/page.test.tsx`
- Test: `src/app/merchant/messages/page.test.tsx`
- Test: `src/app/merchant/messages/[conversationId]/page.test.tsx`
- Test: `src/app/merchant/calendar/page.test.tsx`
- Test: `src/app/customer/booking/confirm/page.test.tsx`
- Test: `src/app/customer/style/[id]/page.test.tsx`
- Test: `src/app/merchant/manage/page.test.tsx`

- [ ] **Step 1: Mark completed checkboxes in this plan as you finish each task**

After each task commit, update the matching checkboxes in this plan from `- [ ]` to `- [x]` so the implementation trail stays auditable.

```md
- [x] **Step 4: Run the merchant calendar and profile tests again**
```

- [ ] **Step 2: Run the full follow-up regression suite**

Run:

```bash
npm test -- 'src/app/customer/profile/page.test.tsx' 'src/app/merchant/profile/page.test.tsx' 'src/app/customer/home/page.test.tsx' 'src/features/customer/TrendingStylesPanel.test.tsx' 'src/app/customer/booking/page.test.tsx' 'src/app/customer/booking/confirm/page.test.tsx' 'src/app/customer/style/[id]/page.test.tsx' 'src/app/customer/messages/page.test.tsx' 'src/app/customer/messages/[conversationId]/page.test.tsx' 'src/app/merchant/messages/page.test.tsx' 'src/app/merchant/messages/[conversationId]/page.test.tsx' 'src/app/merchant/calendar/page.test.tsx' 'src/app/merchant/manage/page.test.tsx'
```

Expected: PASS with no landing-page tests involved.

- [ ] **Step 3: Verify that landing-page files remain untouched**

Run:

```bash
git diff --name-only HEAD~4..HEAD
```

Expected: no files under `src/components/landing` and no `src/app/page.tsx`.

- [ ] **Step 4: Commit the updated plan checklist if it changed**

```bash
git add docs/superpowers/plans/2026-06-07-language-system-rebuild-followups.md
git commit -m "docs: update follow-up plan progress"
```

- [ ] **Step 5: Prepare the branch for review**

```bash
git status --short
git log --oneline -n 8
```

Expected: clean working tree and a linear series of follow-up commits ready for review.

---

## Spec Coverage Check

- Profile switcher placement and collapsed interaction: covered by Task 1
- Customer home requested labels: covered by Task 2
- Booking upload requested labels: covered by Task 2
- Existing message history Chinese/English display: covered by Task 3
- Merchant calendar visible UI copy only: covered by Task 4
- Merchant profile `美甲师管理`: covered by Task 4
- Landing page untouched and regression verification: covered by Task 5

## Placeholder Scan

- No `TODO`, `TBD`, or "similar to" placeholders remain.
- Every task names exact files, exact commands, and concrete assertions or code snippets.

## Type Consistency Check

- This plan keeps the existing `AppLanguage`, `Conversation`, `BookingConversationThread`, and `LanguageProvider` architecture.
- The only planned seeded/history typing extension is additive and stays inside the message-history display path.
