# Landing Journey Section Design

## Goal

Add a new section between `SolutionSection` and `WhyItWorksSection` that reproduces the provided journey screenshot as closely as possible on desktop, while remaining readable on mobile.

## Scope

This section is presentation-focused. It does not introduce new business logic, routing, or data fetching.

Included:
- A new `JourneySection` component inserted between the existing landing sections
- Two timeline rows: merchant journey and user journey
- Four cards per row, driven by structured content data
- Light interaction only: hover scale, shadow lift, and subtle reveal motion on scroll
- Responsive mobile layout that stacks content vertically

Excluded:
- Complex step-by-step animation
- Carousel, tab, or click-to-switch behavior
- Changes to surrounding section order beyond inserting the new section

## Architecture

### Component structure

- `LandingPage.tsx`
  - Insert `<JourneySection />` between `<SolutionSection />` and `<WhyItWorksSection />`
- `JourneySection.tsx`
  - Owns the section layout
  - Maps journey data into two visual rows
- `landing-content.ts`
  - Stores the merchant and user journey content in one dedicated export

### Data shape

Use one top-level collection with two rows:

- `merchant`
  - title
  - theme colors
  - items
- `user`
  - title
  - theme colors
  - items

Each item contains:
- `title`
- `description`

This keeps the rendering logic simple and avoids duplicating layout code.

## Visual design

### Desktop

The desktop version should closely match the screenshot:

- Full-width section with two horizontal bands
- Top band uses a blue background
- Bottom band uses a pink background
- Each band has a large rounded title block on the left
- Four white rounded cards align horizontally to the right
- A thin horizontal line runs beneath the cards
- Four circular timeline nodes align with the cards

### Motion

Keep motion intentionally light:

- Cards slightly scale up on hover
- Card shadow deepens on hover
- Timeline node for the hovered card becomes more prominent
- Initial scroll reveal uses a short upward fade-in

If `prefers-reduced-motion` is enabled, motion should be minimized or removed.

### Mobile

Mobile prioritizes readability over exact visual matching:

- Merchant and user rows stack vertically
- The left title block becomes a top label block
- Cards become a vertical list
- Timeline line changes to a vertical guide or is removed if it harms clarity
- Spacing and font sizes scale down while keeping the same visual language

## Styling strategy

Add the new styles into `LandingPage.module.css` to stay consistent with the current landing page organization.

Use dedicated class names for:

- Section shell
- Journey row
- Journey title block
- Journey card rail
- Journey card
- Timeline line
- Timeline node

Avoid coupling the new styles to `SolutionSection` or `WhyItWorksSection`.

## Accessibility

- Use semantic headings for the section and row titles
- Keep all timeline cards readable as normal text content
- Hover effects must not be the only way to access information
- Preserve visible focus styles for any interactive element if cards are rendered as buttons or links

Because the section is primarily informational, non-clickable cards rendered as article-like blocks are preferred unless interaction becomes necessary.

## Testing and verification

Verify:

- Section renders between solution and why-it-works
- Desktop layout shows two distinct horizontal journeys with four cards each
- Hover interaction feels subtle and does not shift surrounding layout
- Mobile layout remains readable and does not overflow horizontally
- Reduced-motion users do not get unnecessary animation

## Risks and mitigations

- Risk: Trying to preserve the desktop geometry on small screens will make the text unreadable
  - Mitigation: Use a separate stacked mobile layout
- Risk: Over-animating the section will clash with the rest of the page
  - Mitigation: Restrict motion to hover lift and short reveal transitions
- Risk: Hardcoded spacing may break if copy changes
  - Mitigation: Drive cards from structured content and use flexible grid sizing
