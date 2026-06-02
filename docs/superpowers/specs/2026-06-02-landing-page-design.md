# Landing Page Design Spec

## Summary

Build a high-fidelity web implementation of the current Canva landing page as the root route at `/`.
The page should prioritize the product-entry use case while still working as a marketing homepage and
lightweight pitch page. The implementation should preserve the current top-level dual CTA pattern and
stay visually close to the Canva composition, with responsive adjustments only where needed for the web.

## Goals

- Recreate the Canva page's information hierarchy as a production-ready landing page in Next.js.
- Preserve the two primary entry points:
  - `用户入口` -> `/customer/home`
  - `商家入口` -> `/merchant/calendar`
- Reflect the provided brand direction:
  - Heading font: `SourceHanSerifSC-Heavy.otf`
  - Body font: `SourceHanSans-VF.otf.ttc`
  - Palette: `#696fc7`, `#a7aae1`, `#f5d3c4`, `#f2aebb`, `#a8d8ea`, `#fff8de`, `#576a8f`, `#d8c7fa`,
    plus black and white
- Use the provided assets from `docs/assets`.
- Support desktop and mobile layouts without losing the original storytelling order.

## Non-Goals

- No CMS or editable content system.
- No multilingual support.
- No lead form or backend submission flow.
- No analytics, experimentation, or tracking work in this iteration.
- No heavy animation system; only restrained motion if it improves polish.

## Source Material

### Confirmed page intent

The landing page must satisfy three use cases at once:

1. External-facing marketing homepage
2. Product entry page
3. Pitch/demo page

Priority is use case `2`, so the page should help users understand the product quickly and then enter the
appropriate product flow.

### Provided assets

- `docs/assets/logo.PNG`
- `docs/assets/hero_icon.PNG`
- `docs/assets/hero_shadow.png`
- `docs/assets/fonts/SourceHanSerifSC-Heavy.otf`
- `docs/assets/fonts/SourceHanSans-VF.otf.ttc`

## Page Architecture

The page should remain a single long-form landing page rendered by `src/app/page.tsx`.

### 1. Hero

Purpose:
Make the product understandable immediately and surface the two primary entry points without requiring
scrolling.

Content:

- Logo / brand mark
- Top-level role entry labels: `用户入口`, `商家入口`
- The same two CTA destinations currently used by the landing page
- Core product definition derived from the Canva page:
  `让美甲预约更智能：基于AI拆解美甲款式图片，集合报价、预约、款式库的智能全链运营系统`
- Supporting value statement:
  `少沟通、多成交`

Behavior:

- On desktop, the hero may use a richer asymmetric composition if it helps preserve the Canva feel.
- On mobile, the hero should stack cleanly while keeping both CTAs visible without hunting.
- The two CTAs should remain the primary interactive focus of the section.

### 2. Problem Section

Purpose:
Explain why the product exists and frame the workflow pain clearly.

Section title:

- `好看的款式背后，是低效的预约流程`

Structure:

- Split the long Canva copy into three readable web cards or panels.
- Preserve the problem categories implied by the Canva page:
  - `报价`
  - `选款`
  - `预约`

Expected content focus:

- Price variability creates repeated manual quoting work
- Style selection is visually rich but structurally weak
- Fixed-duration scheduling fails to reflect actual service complexity

### 3. Capability Section

Purpose:
Translate the product promise into concrete product capabilities.

Subsections:

1. `AI 识图`
2. `款式购物车`
3. `商家图册`

For each subsection, the page should present:

- A concise headline
- A short value statement
- A fuller explanation adapted from the Canva copy

Expected tone:

- Product-focused, not investor-jargon-heavy
- Clear enough to work in both homepage and pitch contexts

### 4. Summary / Outcomes Section

Purpose:
Compress the product story into memorable outcome statements.

Content should preserve the Canva summary lines:

- `试戴选款，帮助决策`
- `AI识图，拆解款式`
- `快速报价预约，促成交`
- `款式沉淀，再次转化`

Presentation:

- Use strong visual grouping, such as a grid, ribbon, or stateless highlight cards
- This section should feel like a synthesis, not a repeat of the earlier copy

### 5. Closing CTA Section

Purpose:
Re-offer the two routes after the visitor understands the product.

Content:

- Repeat the two core CTAs
- Keep labels aligned with the hero
- Reinforce that the customer and merchant flows are both active product entry points

## Visual Direction

The landing page should not look like the current lightweight shell homepage. It should feel closer to a
web-rendered brand poster or polished concept page.

### Typography

- Use local font loading via `next/font/local`
- Heading display style uses `SourceHanSerifSC-Heavy.otf`
- Body, UI, and long-form copy use `SourceHanSans-VF.otf.ttc`
- English fallback fonts can be added only as supporting fallbacks

### Color

Suggested usage:

- Primary accent: `#696fc7`
- Deep structural text / support color: `#576a8f`
- Warm background tones: `#fff8de`, `#f5d3c4`
- Supporting accents: `#a7aae1`, `#d8c7fa`, `#a8d8ea`, `#f2aebb`
- Base neutrals: white and black

Guidance:

- Avoid a flat white SaaS page
- Use layered gradients, soft shadows, and atmospheric surfaces
- Keep contrast sufficient for long Chinese copy

### Imagery and Decoration

- Use the provided `logo.PNG`, `hero_icon.PNG`, and `hero_shadow.png`
- Generate simple supporting icons or abstract shapes in code/CSS/SVG as needed
- Decorative elements should reinforce the Canva composition rather than compete with the content

## Technical Design

### Routing

- Keep the landing page on `src/app/page.tsx`
- Preserve current CTA destinations by continuing to resolve:
  - customer home path from `getMockSession('customer').homePath`
  - merchant home path from `getMockSession('merchant').homePath`

This currently maps to:

- customer -> `/customer/home`
- merchant -> `/merchant/calendar`

### Asset Handling

- The provided assets currently live under `docs/assets`
- The implementation should make them usable by the app in a stable way
- Prefer a simple static-asset strategy appropriate for Next.js, with minimal duplication and clear paths

Implementation note:
The code change may either move/copy the needed runtime assets into `public/landing/...` or introduce a
repo-consistent alternative, but the final approach should keep asset ownership obvious and avoid scattering
landing assets across unrelated folders.

### Styling

- Keep landing-specific styles cohesive instead of spreading unrelated one-off rules across the codebase
- Reuse existing global tokens only where they help; do not force the landing page into the mobile app shell
- Preserve existing customer and merchant page styling behavior

### Responsiveness

The landing page must support:

- Desktop-first composition for fidelity to the Canva page
- Clean mobile fallback without broken reading order
- CTA visibility and readability at smaller widths

## Testing Strategy

### Automated

- Update or extend the landing page test at `src/app/page.test.tsx`
- Verify:
  - the page renders
  - the primary heading renders
  - both CTA links resolve to the expected destinations
  - key landing copy appears

### Verification

Run at least:

- the relevant Vitest test(s) for the landing page
- a build or equivalent compile check if feasible in the current environment

If practical during implementation:

- visually inspect the page locally to confirm section rhythm, font loading, and CTA prominence

## Risks and Mitigations

### Risk: Canva-to-web mismatch

The Canva composition may not map directly to responsive web layout.

Mitigation:

- Preserve content order and visual intent
- Allow responsive restructuring where necessary without changing the story

### Risk: Font rendering differences

Local font metrics may change line breaks and spacing compared with Canva.

Mitigation:

- Tune typography and section widths after the first pass
- Prefer robust spacing systems over pixel-perfect assumptions

### Risk: Asset-path ambiguity

The supplied assets currently live in `docs/assets`, which is not the most natural runtime asset location.

Mitigation:

- Consolidate runtime usage into an explicit landing asset strategy during implementation

## Acceptance Criteria

- `/` renders a complete single-page landing page based on the current Canva design
- The page preserves the Canva story order and the top dual-entry CTA concept
- The landing page uses the supplied fonts and color palette
- The customer CTA points to `/customer/home`
- The merchant CTA points to `/merchant/calendar`
- The page is readable and visually coherent on desktop and mobile
- Existing non-landing product routes continue to behave as before
