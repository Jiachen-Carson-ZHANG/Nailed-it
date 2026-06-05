---
name: Nailed-it
description: Soft-tech nail booking system with social browsing energy and operational clarity.
colors:
  accent-pink: "#ec5d7b"
  accent-pink-strong: "#c73963"
  accent-pink-soft: "#ffe4eb"
  landing-purple: "#696fc7"
  landing-lavender: "#d8c7fa"
  landing-light-purple: "#a7aae1"
  landing-blue: "#a8d8ea"
  landing-cream: "#fff8de"
  surface-base: "#fff8f7"
  surface-strong: "#ffffff"
  text-ink: "#24181f"
  text-muted: "#6c5a65"
  border-soft: "#2e1f2b14"
  success: "#2e8b6c"
  warning: "#d97706"
  danger: "#b91c1c"
typography:
  display:
    fontFamily: "\"Source Han Serif SC\", \"Songti SC\", \"STSong\", serif"
    fontSize: "clamp(2.4rem, 4.1vw, 4.4rem)"
    fontWeight: 800
    lineHeight: 1.08
  headline:
    fontFamily: "\"Source Han Serif SC\", \"Songti SC\", \"STSong\", serif"
    fontSize: "clamp(2rem, 3vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.05
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "8px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  hero: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent-pink}"
    textColor: "{colors.surface-strong}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.accent-pink-strong}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  chip-default:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.accent-pink-soft}"
    textColor: "{colors.accent-pink-strong}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  card-default:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.text-ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  landing-cta-pill:
    backgroundColor: "{colors.landing-cream}"
    textColor: "{colors.landing-purple}"
    rounded: "{rounded.pill}"
    padding: "0 32px"
    height: "56px"
  solution-tab-cart:
    backgroundColor: "{colors.accent-pink}"
    textColor: "{colors.landing-cream}"
    rounded: "{rounded.pill}"
    padding: "12px 22px"
    height: "62px"
---

# Design System: Nailed-it

## Overview

**Creative North Star: "The Soft-Tech Beauty Console"**

Nailed-it should feel like a beauty-native product that understands both browsing desire and booking logistics. The visual system pairs airy, pastel social-discovery cues with enough structure to support pricing, scheduling, and merchant operations. It should feel young, feminine, and confident, but not sugary, toy-like, or vague.

The system works in two related modes. The product shell uses soft pink surfaces, warm white cards, and crisp dark ink to keep flows readable and trustworthy. The landing and storytelling surfaces are allowed to go further with lavender, cream, sky blue, and serif display typography so the brand can feel more expressive without losing clarity.

This system explicitly rejects generic enterprise dashboard stiffness, dark cyberpunk AI theatrics, and blunt beauty-commerce templates. It also rejects loud neon gradients, glass-heavy AI gloss, and overly cute decoration that would undercut trust in quotes, availability, or merchant workflow.

**Key Characteristics:**
- Pastel color is used as product voice, not as decoration alone.
- Operational screens stay calm and legible, even when the brand gets softer and more expressive.
- Display moments use serif drama, while utility moments return to a modern sans rhythm.
- Social-browsing energy should lead users toward action, not trap them in inspiration-only loops.

## Colors

The palette combines operational blush neutrals with a brighter landing palette of lavender, cream, and sky blue, so the brand can move between product trust and inspiration-led storytelling without feeling like two separate products.

### Primary
- **Signal Pink** (`#ec5d7b`): The main product accent for CTAs, active states, badges, and emphasis moments where the interface needs a clear answer or next step.
- **Velvet Lavender** (`#696fc7`): The strongest brand field color on landing sections, display headlines, and narrative surfaces that need more emotional presence than the app shell.

### Secondary
- **Powder Sky** (`#a8d8ea`): Used in landing buttons, visual panels, and cool-side storytelling blocks where the system needs relief from pink-heavy surfaces.
- **Blush Wash** (`#ffe4eb`): Used for selected chips, supportive highlights, and soft feedback surfaces that should feel warm rather than alert-like.

### Tertiary
- **Butter Cream** (`#fff8de`): Used as a soft hero button fill, warm contrast against lavender, and a gentle high-key surface on the landing page.
- **Mist Lavender** (`#d8c7fa`): A supporting brand note for decorative sections and tertiary surface variation.

### Neutral
- **Petal White** (`#fff8f7`): The default app background. It keeps the product from feeling sterile while staying quiet enough for dense workflows.
- **Pure Surface** (`#ffffff`): Used for cards, dialogs, sheets, and readable form containers.
- **Ink Plum** (`#24181f`): Primary text and tooltip background. It anchors the palette and prevents the pastel system from drifting into low-trust softness.
- **Muted Mauve** (`#6c5a65`): Secondary text, helper copy, and lower-emphasis metadata.
- **Soft Border** (`rgba(46, 31, 43, 0.08)`): Hairline separation for cards, bars, and chips. Borders stay subtle and should not dominate the layout.

### Named Rules
**The Dual-Surface Rule.** Product surfaces default to blush neutrals plus pink emphasis. Landing surfaces may introduce lavender, cream, and sky blue when storytelling needs more identity, but app workflows should not become a rainbow patchwork.

**The Trust-Through-Ink Rule.** Whenever pastel backgrounds get lighter or more decorative, text must move toward Ink Plum or a similarly dark hue. Readability wins over softness.

## Typography

**Display Font:** Source Han Serif SC (with Songti SC / STSong fallback)  
**Body Font:** Inter (with Apple system sans fallbacks)  
**Label/Mono Font:** Inter

**Character:** Typography splits clearly by task. Display moments use a confident Chinese serif to create elegance and feminine authority on landing pages. Product flows return to Inter for faster scanning, cleaner controls, and predictable operational rhythm.

### Hierarchy
- **Display** (800, `clamp(2.4rem, 4.1vw, 4.4rem)`, 1.08): Reserved for landing hero statements and major section headlines that carry the brand voice.
- **Headline** (800, `clamp(2rem, 3vw, 3rem)`, 1.05): Used for feature blocks, problem cards, and large section titles where the brand still needs strong presence.
- **Title** (700, `1.75rem`, 1.2): Used for page titles, major cards, and dialog titles in the product shell.
- **Body** (400, `1rem`, 1.6): Default reading size for descriptions, metadata, helper copy, and multi-line product content. Keep long-form body copy near a 65-75ch reading width when the layout allows.
- **Label** (700, `0.75rem`, 1, normal): Used for chip labels, section eyebrows, compact CTA text, and utility markers. Labels can go uppercase sparingly, but not as a repeated scaffold on every section.

### Named Rules
**The Two-Mode Type Rule.** Serif is for persuasion and brand expression. Sans is for decisions and workflow. Do not let serif typography spill across dense booking, messaging, or management flows unless a very specific moment earns it.

## Elevation

This system uses a hybrid depth model: most product surfaces are flat in structure but softly lifted through blur, translucent fills, and diffuse shadows. Elevation should feel ambient rather than dramatic. Shadows are there to separate layers and signal tactility, not to simulate hard material depth.

### Shadow Vocabulary
- **Soft Surface** (`0 16px 40px rgba(74, 39, 55, 0.08)`): Default lift for cards, discovery heroes, and contained panels that need warmth without feeling heavy.
- **Raised Surface** (`0 8px 20px rgba(74, 39, 55, 0.12)`): Used for tighter elevated elements or hovered cards that need a little more separation.
- **Overlay Surface** (`0 24px 60px rgba(74, 39, 55, 0.18)`): Reserved for dialogs, large overlays, and floating surfaces that sit clearly above the page.
- **Landing Object Shadow** (`0 12px 30px rgba(236, 93, 123, 0.28)`): Used on accent objects like the brand mark where colored lift is part of the visual storytelling.

### Named Rules
**The Ambient Lift Rule.** Surfaces should appear cushioned and light, not sharply stacked. Prefer wide, soft shadows and translucent fills over dense black drop shadows.

## Components

### Buttons
- **Character:** Buttons are rounded, compact, and decisive. They should feel friendly enough for a beauty product, but firm enough for booking confirmation and merchant workflow.
- **Shape:** Default buttons use a medium radius (`8px`). Landing CTA buttons and tab pills can expand to full pill radius (`999px`) for a more expressive profile.
- **Primary:** Pink fill with white text, minimum height `44px`, standard horizontal padding `16px`. This is the default action button in product flows.
- **Hover / Focus:** Motion stays short and subtle. Product buttons shift through color/transform transitions around `120ms`; landing pills may lift by `1px`. Focus rings use a translucent plum outline rather than a browser-default blue.
- **Secondary / Ghost / Tertiary:** Secondary buttons use white fill with soft border and dark text. Ghost buttons stay transparent or near-transparent and inherit stronger accent text for dismissive or lightweight actions.

### Chips
- **Style:** Chips are pill-shaped (`999px`), white by default, softly bordered, and sized for fingertip use at `36px` minimum height.
- **State:** Selected chips switch to blush background with strong pink text. Disabled chips should keep their structure but drop energy through contrast and interaction state, not through total disappearance.

### Cards / Containers
- **Character:** Cards are soft containers, not dashboard bricks. They create trust and structure while keeping the system visually breathable.
- **Corner Style:** Standard cards use `8px` radius in product flows and may expand to `20px` or `34px`-ish radii in landing storytelling panels.
- **Background:** Cards default to pure white or slightly translucent warm white over the blush page background.
- **Shadow Strategy:** Most cards use the Soft Surface shadow. Narrative landing cards may use larger radii and quieter or no borders when section color already provides separation.
- **Border:** Borders are low-contrast and thin. Avoid high-contrast outlines unless communicating an active or selected state.
- **Internal Padding:** Most cards sit on the `16px` to `24px` spacing steps, with larger editorial landing panels extending beyond that.

### Inputs / Fields
- **Style:** Inputs should live on white or near-white surfaces with clear stroke definition and the same medium-radius geometry as buttons and cards.
- **Focus:** Focus feedback should rely on accent-tinted outlines, border shifts, or glow treatments that are visible without becoming loud.
- **Error / Disabled:** Error states should use the system danger red intentionally, while disabled states should lower contrast and interactivity without making the field illegible.

### Navigation
- **Top Bar:** The top bar is a sticky, translucent shell with a blurred blush background, low-contrast divider, and strong brand title weight.
- **Bottom Tab Bar:** Mobile navigation uses a four-column soft grid with active items highlighted through pale pink fill and stronger accent text rather than hard underlines.
- **Typography:** Navigation labels stay in the sans system, compact, and semibold for fast scanning.

### Overlays
- **Bottom Sheet:** Sheets are rounded only at the top, nearly opaque blush-white, and feel like a continuation of the app rather than a foreign layer.
- **Dialog:** Dialogs use pure white surfaces, overlay shadow, compact typography, and small corner radii to stay readable and focused.
- **Tooltip:** Tooltips invert into Ink Plum with white text for maximum contrast and clear hierarchy.

### Signature Component
- **Solution Tabs and Story Panels:** Landing feature tabs and solution panels are the clearest example of Nailed-it's expressive mode. They pair pill selectors with large serif headlines and full-color panel backgrounds. Use this pattern only for high-level storytelling or feature explanation, not for dense task flows.

## Do's and Don'ts

### Do:
- **Do** use `#ec5d7b` as the default action accent in product flows, with white text and medium-radius geometry.
- **Do** switch to `Source Han Serif SC` for brand headlines, hero statements, and storytelling sections that need feminine authority.
- **Do** keep operational screens grounded in `#fff8f7`, `#ffffff`, `#24181f`, and `#6c5a65` so pricing, messages, and calendars remain easy to scan.
- **Do** use pastel colors in roles, not at random. Lavender, cream, and sky blue should have a compositional reason.
- **Do** preserve reduced-motion support by collapsing decorative animation when `prefers-reduced-motion` is enabled.
- **Do** keep touch targets around `44px` tall in interactive product controls whenever possible.

### Don't:
- **Don't** make this feel like a generic enterprise dashboard. Avoid heavy grid severity, cold grayscale UI, and purely utilitarian admin styling.
- **Don't** turn the product into a dark cyberpunk AI tool. Avoid heavy black UI, neon glows, and aggressive futuristic gradients.
- **Don't** use a blunt beauty e-commerce template. The product is not just a catalog and checkout flow.
- **Don't** add glass-heavy AI gloss, decorative blur everywhere, or purple-on-black "AI" theatrics.
- **Don't** push the interface into overly cute decoration that weakens trust in quotes, time estimates, or merchant scheduling.
- **Don't** rely on color alone to explain booking states, AI confidence, or merchant actions.
- **Don't** let serif typography or full-color landing treatments bleed into dense management screens unless the moment is intentionally brand-led and still readable.
