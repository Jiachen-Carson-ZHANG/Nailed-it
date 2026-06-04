# Nailed Landing Page Redesign Design Spec

Date: 2026-06-02
Project: `/Users/bytedance/Documents/nailed-it`
Target route: `/`

## Goal

Rewrite the current landing page so it visually matches the provided desktop screenshots as closely as possible in the browser.

This is a focused marketing-page rewrite, not a product-shell refinement. The new page must explain the product, the booking pain points, the core features, the closed-loop value, and provide entry points into the existing user and merchant demo flows.

## Confirmed Scope

Included:

- Replace the current landing page at `/`
- Build exactly five sections in this order:
  1. Hero
  2. Problem
  3. Solution / Core Features
  4. Why It Works
  5. CTA
- Reuse local assets from `docs/assets`
- Use local serif fonts from `docs/assets/fonts`
- Implement desktop-first layout with mobile adaptation
- Implement light Hero entrance animation
- Implement tab switching in Solution
- Implement scroll-driven type-size changes in Why It Works

Excluded:

- Navigation bar
- Footer
- FAQ
- Pricing section
- Testimonials or social proof
- Additional copywriting
- Additional sections
- Phone mockup interior UI for Solution part 3

## User Decisions Captured

- Hero buttons should use real in-app routes
- CTA buttons should use the same real routes as Hero
- Solution should use real tab switching rather than long-form stacked states
- Desktop fidelity is the first priority, while mobile still needs to work cleanly
- Problem icons are now partly asset-backed; the calendar icon remains custom SVG
- Hero needs a subtle `0.3s` entrance animation
- Why It Works should be scroll-driven: the current step becomes larger while other lines become smaller
- The Why It Works emphasis is based on font size changes, not color highlighting

## Route Targets

- `用户入口` -> `/customer/home`
- `商家入口` -> `/merchant/calendar`
- `Try as User` -> `/customer/home`
- `Try as Merchant` -> `/merchant/calendar`

## Content Constraints

All Chinese and English copy must match the requirement document exactly.

Do not:

- paraphrase text
- add slogans
- add helper labels
- add extra explanatory paragraphs
- change section order

## Visual Direction

The page should feel soft, feminine, clean, and lightly technical. The screenshots already define the direction, so implementation should optimize for fidelity over invention.

Key characteristics:

- large whitespace
- serif Chinese display typography
- rounded blocks and pill buttons
- very restrained shadows
- flat color fields instead of rich gradients
- desktop layouts that preserve the wide compositions from the mockups

## Design Tokens

Only these colors may be used:

- `#696fc7` main purple background
- `#a7aae1` light purple
- `#f5d3c4` skin pink
- `#f2aebb` pink
- `#a8d8ea` light blue
- `#fff8de` cream yellow
- `#576a8f` deep blue-gray text and strokes
- `#d8c7fa` pale lavender logo/supporting stroke
- `#ffffff`
- `#000000`

Shape rules:

- major panels: `32px` to `44px` radius
- feature and problem cards: `28px` to `40px` radius
- buttons: `999px`

Shadow rules:

- only the Hero illustration should have a visible soft oval shadow
- other sections should stay mostly flat

## Typography

Use a serif family sourced from local assets, with Source Han Serif SC as the primary display face.

Typography rules:

- section titles and feature display text use serif display styling
- body copy should remain visually consistent with the display family
- do not reintroduce the current landing page's modern sans-serif look as the dominant brand voice

## Asset Mapping

Use these assets from `docs/assets`:

- `logo.PNG` for the Hero logo lockup
- `hero_icon.PNG` for the Hero right-side illustration
- `money.PNG` for Problem card 1 icon
- `choice.PNG` for Problem card 2 icon
- `loop.PNG` for Why It Works loop artwork if it matches the screenshot closely enough

Conditional assets and fallbacks:

- `calendar` icon is not provided and must be recreated as inline SVG
- `screen.PNG` should only be used if it naturally fits the final composition; it is not mandatory
- if `loop.PNG` is visually too different from the screenshot, replace it with inline SVG loop arrows

## Component Architecture

Keep the route entry at `src/app/page.tsx`, but move the landing implementation into focused components.

Recommended structure:

```text
src/app/page.tsx

src/components/landing/
  LandingPage.tsx
  HeroSection.tsx
  ProblemSection.tsx
  ProblemCard.tsx
  SolutionSection.tsx
  FeatureTabs.tsx
  FeaturePanel.tsx
  PhoneMockup.tsx
  WhyItWorksSection.tsx
  CalendarIconSvg.tsx
  LoopArrowGraphic.tsx
  CtaSection.tsx
```

Styling approach:

- create landing-specific styles under a dedicated namespace
- do not continue using the current landing page mobile-product styling
- avoid leaking landing styles into customer and merchant pages

## Section Design

### 1. Hero

Structure:

- white full-screen section
- two-column desktop layout
- left side: logo, title, subtitle, two buttons
- right side: hero illustration plus soft oval shadow

Content:

- title: `少沟通，多成交`
- subtitle: `让美甲预约更智能： 基于AI拆解美甲款式图片， 集合报价、 预约、 款式库的智能全链运营系统`
- buttons: `用户入口`, `商家入口`

Desktop behavior:

- left block should sit slightly toward the upper-left instead of dead center
- illustration sits centered-right
- spacing should mimic the screenshot rather than generic hero conventions

Animation:

- one-time entrance on initial load
- about `0.3s`
- use subtle `opacity` plus a very small upward settle
- no dramatic scaling, bouncing, or stagger spectacle

### 2. Problem

Structure:

- full-screen purple section
- centered cream title
- three equal columns beneath
- each column has a top icon and a white rounded card below

Columns:

1. `报价`
2. `选款`
3. `预约`

Icon sourcing:

- card 1 uses `money.PNG`
- card 2 uses `choice.PNG`
- card 3 uses custom inline `calendar` SVG

Card styling:

- white background
- deep blue-gray text
- large serif headings
- bullet copy matching the requirement document exactly

### 3. Solution / Core Features

Structure:

- white full-screen section
- left side fixed phone mockup
- right side top tabs plus one large content panel

Interaction model:

- true tab switching
- default tab is `AI 识图`
- switching changes the active button context, panel color, title color, subtitle, and body copy
- the module remains one feature system with three states, not three parallel cards

Phone mockup:

- deep blue-gray outer stroke
- rounded frame and notch
- white interior
- interior remains blank for now

Tabs:

1. `AI 识图`
2. `款式购物车`
3. `商家图册`

Panel states:

- `AI 识图` -> light blue panel, deep blue-gray display title
- `款式购物车` -> pink panel, cream display title
- `商家图册` -> cream panel, light purple display title

Animation:

- keep transitions very light
- simple fade or soft content swap around `160ms` to `180ms`
- no decorative hover choreography

### 4. Why It Works

Purpose:

Express the operating loop rather than repeat feature descriptions.

Structure:

- full-screen purple section
- left large loop visual
- right four oversized lines of serif text

Copy:

1. `试戴选款， 帮助决策`
2. `AI识图， 拆解款式`
3. `快速报价预约， 促成交易`
4. `款式沉淀， 再次转化`

Loop visual:

- prefer `loop.PNG` if it is close enough to the screenshot
- otherwise render a custom inline SVG loop-arrow graphic
- color stays `#fff8de`
- allow the graphic to crop against the left edge for the oversized look

Scroll interaction:

- desktop section behaves as a four-step scroll-driven rhythm zone
- as the user scrolls through the section, one line becomes larger while the others become smaller
- this is a typography-scale interaction, not a color highlight interaction
- line emphasis should feel decisive but still elegant

Loop motion:

- the loop should subtly react as the active step changes
- motion can be done through gentle transform, positional shift, or segment emphasis
- avoid flashy spins, long tweens, or arcade-style animation

Mobile behavior:

- keep the section readable and lighter-weight
- preserve the sense of progression without requiring heavy sticky-scrollytelling mechanics

### 5. CTA

Structure:

- white full-screen closing section
- centered title, subtitle, and two buttons
- no repeated hero illustration

Content:

- title: `准备好让美甲预约更智能了吗？`
- subtitle: `选择你的身份，进入 Nailed-it 的智能预约体验。`
- buttons: `Try as User`, `Try as Merchant`

Behavior:

- button targets match the Hero buttons
- keep the closing screen visually clean and conversion-focused

## Responsive Strategy

Desktop is the primary target. Mobile adaptation should preserve structure while simplifying layout.

Desktop rules:

- every section targets `min-height: 100vh`
- preserve the wide layout compositions from the screenshots
- do not compromise desktop fidelity just to make tablet and mobile easier

Mobile rules:

- Hero stacks vertically, with text before artwork
- Problem becomes a single-column card stack
- Solution becomes a single-column tab module, but still keeps real tab switching
- Why It Works stacks visual above text and uses a lighter progression model
- CTA remains centered and easy to tap

## Accessibility And Motion Safety

- all interactive controls must remain keyboard reachable
- buttons and tabs need clear focus styles
- images that are decorative should use appropriate `alt` handling
- respect `prefers-reduced-motion`
- when reduced motion is enabled, Hero and Why It Works should fall back to static or near-static presentation

## Implementation Notes

- isolate the landing page styling from the rest of the app
- keep components focused and small
- store tab content in a structured data object rather than repeated JSX branches
- use inline SVG for the calendar icon
- use an explicit step model for Why It Works instead of ad-hoc DOM measurements spread across components
- do not place placeholder UI inside the phone mockup

## Testing And Verification

Visual and behavior checks:

- confirm there are exactly 5 sections
- confirm the section order matches the requirement document
- confirm all copy is exact
- confirm all colors come from the approved palette
- confirm the Hero matches the screenshot composition closely
- confirm Problem is purple with three white cards and three top icons
- confirm Solution is a tab module, not a three-card grid
- confirm Why It Works enlarges the current line by scroll step and shrinks the others
- confirm Hero entrance animation is subtle and about `0.3s`
- confirm mobile remains readable and usable

Regression checks:

- existing customer route `/customer/home` still works
- existing merchant route `/merchant/calendar` still works
- landing rewrite does not alter global styling for internal product routes

## Acceptance Summary

The work is successful when the landing page feels like the supplied design recreated in the browser rather than a loose adaptation, while still routing into the existing demo flows and preserving a clean mobile fallback.
