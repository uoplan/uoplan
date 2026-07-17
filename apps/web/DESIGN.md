---
name: uoplan
description: A fast, requirement-first course planner and timetable generator for University of Ottawa students.
colors:
  bg: "oklch(0.2216 0.0117 293.07)"
  surface: "oklch(0.2668 0.0186 294.27)"
  surface-sunken: "oklch(0.1987 0.008 297.1)"
  surface-overlay: "oklch(0.3003 0.0216 292.69)"
  surface-hover: "oklch(0.3241 0.0212 292.82)"
  border: "oklch(0.2837 0.0201 293.41)"
  border-strong: "oklch(0.3604 0.0258 291.16)"
  text: "oklch(0.9496 0.0096 273.35)"
  text-muted: "oklch(0.7654 0.0232 274.64)"
  text-dim: "oklch(0.6454 0.0375 278.13)"
  text-inverse: "oklch(0.2242 0.0137 278.83)"
  accent: "oklch(0.809 0.105 251.813)"
  accent-soft: "oklch(0.4012 0.0625 265.94)"
  on-accent: "oklch(0.2217 0.0412 259.27)"
  info: "oklch(0.755 0.1 234)"
  warning: "oklch(0.775 0.115 64)"
  success: "oklch(0.755 0.11 155)"
  danger: "oklch(0.725 0.115 22)"
  garnet: "oklch(0.5529 0.2103 20.26)"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, Times New Roman, serif"
    fontSize: "clamp(2rem, 5vw, 3.25rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "normal"
  headline:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 400
    lineHeight: 1.15
  title:
    fontFamily: "DM Mono, ui-monospace, Menlo, monospace"
    fontSize: "1rem"
    fontWeight: 600
    letterSpacing: "0.01em"
  body:
    fontFamily: "DM Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "DM Mono, ui-monospace, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.04em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.md}"
    padding: "8px 18px"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.text}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
  badge:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  tooltip:
    backgroundColor: "{colors.surface-overlay}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
---

# Design System: uoplan

## 1. Overview

**Creative North Star: "The Focused Night Desk"**

uoplan is the calm, competent tool a uOttawa student reaches for at 11pm the week registration opens. The whole system is built around one physical scene: a focused student at a dark desk, reading a schedule, wanting the timetable to appear and the anxiety to leave. The canvas is a warm violet-charcoal, the content is light, and nothing on screen competes for attention it hasn't earned. It reads as a serious instrument made by someone who actually attends the university, not a template bought off a shelf.

The signature move is typographic contrast: **DM Serif Display** for headings gives every screen an editorial, considered confidence, while **DM Mono** carries all body and UI text with the quiet precision of a terminal. That serif-over-monospace pairing is what makes uoplan feel like neither a SaaS dashboard nor a campus portal. Colour is deliberately scarce. Neutrals are tinted toward the theme's hue, borders are barely-there hairlines, and the single accent (a pastel sky blue on the default dark theme) shows up only where interaction lives. Depth comes from soft, diffuse shadows and a two-pixel lift on hover, never from hard outlines or stacked cards.

This system explicitly rejects the two worlds it sits between. It is not **uoCampus or Brightspace**, boxy, dated, institutional. It is not a **generic SaaS dashboard**, no hero-metric templates, no gradient cards, no confetti illustrations. Restraint in decoration, generosity in information.

**Key Characteristics:**

- Dark-first, warm-neutral canvas; light content on a violet-charcoal surface.
- Editorial serif headings over a monospace body, structural contrast without extra colour.
- One accent, used sparingly, applied to interactive controls rather than sprayed across the page.
- Soft diffuse elevation and a subtle hover lift; flat and quiet at rest.
- Dense information, low visual noise. Every element earns its place.

## 2. Colors

A restrained, hue-tinted palette: neutrals carry a faint violet cast, one pastel accent marks interactivity, and status hues stay dimmed so they read as calm signals rather than alarms. Every value is authored in OKLCH; hex never appears in the codebase.

### Primary

- **Pastel Sky Blue** (`oklch(0.809 0.105 251.813)`): The single interactive accent on the default dark theme. Focus rings, checked checkboxes/radios/switches, active tabs, selected combobox options, links inside prose. Its rarity is the point.
- **Accent Soft** (`oklch(0.4012 0.0625 265.94)`): The muted fill behind accent states (selected pills, soft banners), so highlights sit on-surface instead of glowing.

### Neutral

- **Violet Charcoal** (`oklch(0.2216 0.0117 293.07)`): The app background, a warm dark violet, never `#000`.
- **Raised Slate** (`oklch(0.2668 0.0186 294.27)`): Default card and panel surface, one step above the background.
- **Sunken Slate** (`oklch(0.1987 0.008 297.1)`): Recessed wells (inputs at rest, code, insets).
- **Overlay Slate** (`oklch(0.3003 0.0216 292.69)`): Floating surfaces, tooltips, popovers, overlays.
- **Hairline Border** (`oklch(0.2837 0.0201 293.41)`): Barely-there dividers that let cards read as soft shapes, not outlined boxes.
- **Strong Border** (`oklch(0.3604 0.0258 291.16)`): The more visible stroke reserved for input affordances.
- **Porcelain** (`oklch(0.9496 0.0096 273.35)`): Primary text.
- **Muted Porcelain** (`oklch(0.7654 0.0232 274.64)`) / **Dim Porcelain** (`oklch(0.6454 0.0375 278.13)`): Secondary and tertiary text.

### Status (dimmed, not bright)

- **Info Blue** (`oklch(0.755 0.1 234)`), **Warning Amber** (`oklch(0.775 0.115 64)`), **Success Green** (`oklch(0.755 0.11 155)`), **Danger Red** (`oklch(0.725 0.115 22)`): Soft pastel signals. Each ships with a `*-soft` fill derived via `color-mix` so the tint always tracks the base hue.

### Theme Accents

- **uOttawa Garnet** (`oklch(0.5529 0.2103 20.26)`): The accent in the "Garnet & Grey" (Gee-Gees) theme, replacing the sky blue over deep garnet-tinted charcoals.

### Named Rules

**The One Accent Rule.** Each theme has exactly one interactive accent (sky blue on dark, a darker blue on light, garnet on Gee-Gees). It marks where interaction lives and appears on a small fraction of any screen. Never introduce a second decorative accent.

**The Neutral-Button Rule.** Buttons deliberately do _not_ use the accent. Mantine's `primaryColor` is a near-neutral `constructBlack`; the accent is wired per-control (checkbox, radio, switch, tab) via CSS variables. Primary actions read as confident graphite, not coloured chrome.

**The Tinted-Neutral Rule.** No pure black or white. Every neutral is tinted toward the active theme's hue (violet on dark, warm parchment on light, garnet on Gee-Gees) at low chroma.

## 3. Typography

**Display Font:** DM Serif Display (with Georgia, Times New Roman, serif)
**Body / UI Font:** DM Mono (with ui-monospace, Menlo, monospace)
**Mono Font:** DM Mono (shared with body)

**Character:** An editorial serif meets a working terminal. DM Serif Display gives headings a confident, printed-page authority at a single weight (400); DM Mono makes every label, table cell, and paragraph feel precise and machine-honest. The contrast between the two, not colour, is the primary hierarchy signal.

### Hierarchy

- **Display** (400, `clamp(2rem, 5vw, 3.25rem)`, line-height 1.05): DM Serif Display. Page and hero titles.
- **Headline** (400, ~1.75rem, line-height 1.15): DM Serif Display. Section headings.
- **Title** (600, ~1rem, DM Mono, letter-spacing 0.01em): Card titles, control labels, emphasized UI text.
- **Body** (400, ~0.9375rem, DM Mono, line-height 1.55): Paragraphs and dense content. Cap measure at 65–75ch.
- **Label** (600, ~0.6875rem, DM Mono, letter-spacing 0.04em, often UPPERCASE): Table headers, eyebrow labels, meta text.

### Named Rules

**The Serif-Headline Rule.** Headings are serif (DM Serif Display) and body is monospace (DM Mono), always. Do not swap a heading to the mono face or a paragraph to the serif; the face contrast _is_ the hierarchy.

**The Single-Weight Display Rule.** DM Serif Display ships at weight 400 only. Do not fake bold or light display type; scale, not weight, differentiates serif headings.

## 4. Elevation

Flat and quiet at rest, soft on interaction. Surfaces are separated primarily by tonal layering (`bg` → `surface` → `surface-overlay`) and 1px hairline borders. Shadows are soft and diffuse, evoking a gentle "cozy lift" rather than a hard, stamped offset (an earlier brutalist offset-shadow language was deliberately retired). On dark themes shadows are near-black; the light theme uses warm graphite-tinted shadows to match the parchment surfaces.

### Shadow Vocabulary

- **Soft SM** (`box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.22)`): Hover lift on cards, banners, and buttons.
- **Soft MD** (`box-shadow: 0 2px 8px rgba(0,0,0,0.34), 0 10px 28px rgba(0,0,0,0.3)`): Raised interactive elements, active button press context.
- **Soft LG** (`box-shadow: 0 10px 30px rgba(0,0,0,0.42), 0 20px 56px rgba(0,0,0,0.36)`): Modals and drawers, the only truly-lifted surfaces.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest and gain shadow only as a response to state. Interactive cards use `.soft-lift`, translating `translateY(-2px)` with a Soft SM shadow on hover, settling back to `translateY(0)` on press. All lift is disabled under `prefers-reduced-motion`.

## 5. Components

Built on Mantine v9, themed entirely through `--app-*` CSS variables so all three themes track from one component definition. Nested pseudo-states live in real CSS (`global.css`) because Mantine v9 drops them from the `styles` object.

### Buttons

- **Shape:** Rounded, `md` radius (12px).
- **Primary:** Neutral graphite fill (Mantine `constructBlack` primary), `text-inverse` label, weight 600, letter-spacing 0.01em. Not accent-coloured.
- **Hover / Focus:** Lifts `translateY(-2px)` with Soft MD shadow; press settles to `translateY(0)` with Soft SM. Motion removed under reduced-motion.

### Chips / Badges

- **Style:** `surface-overlay` fill, `text` colour, pill radius (999px), DM Mono at weight 600, no uppercase transform.

### Cards / Containers

- **Corner Style:** `md` radius (12px).
- **Background:** `surface`, one tonal step above the page background.
- **Shadow Strategy:** Flat at rest; add `.soft-lift` for interactive cards (see Elevation).
- **Border:** 1px `border` hairline (soft shape, not an outlined box).
- **Internal Padding:** ~16px (`spacing.md`).

### Inputs / Fields

- **Style:** `surface`/`sunken` fill, 1px `border-strong` stroke, `md` radius.
- **Focus:** Border shifts to the theme `focus-ring` (accent), driven by Mantine's `--input-bd-focus` var, no glow.

### Navigation & Overlays

- **Modals / Drawers:** `lg` radius (18px), 1px border, Soft LG shadow, header divided by a hairline.
- **Tooltips:** `surface-overlay` fill, `border-strong` stroke, `sm` radius, weight 500.
- **Command center (Spotlight):** Borderless search row; action rows use a radius computed to keep an even gap into the card corners.

### Signature Component: WeekCalendar

The generated weekly timetable is the product's centerpiece. Event cards are tinted by course colour mixed with the surface: the card background is the course hue mixed with `--event-mix-base` by `--event-fill` (38% on dark, 60% on light), and `--app-on-event` sets legible text on that tint, so events read as soft coloured blocks that stay on-theme in every scheme.

## 6. Do's and Don'ts

### Do:

- **Do** author every colour in OKLCH and reference it through an `--app-*` token. Never hardcode a hex value.
- **Do** keep DM Serif Display for headings and DM Mono for body/UI text; let face contrast carry hierarchy.
- **Do** keep the accent rare, on interactive controls and focus states, on a small fraction of any screen.
- **Do** separate surfaces with tonal layering plus 1px hairlines first; reach for shadow only on state change.
- **Do** cap body measure at 65–75ch and respect `prefers-reduced-motion` on every lift and transition.
- **Do** keep primary buttons neutral graphite; wire the accent per-control via CSS variables.

### Don't:

- **Don't** make it look like **uoCampus or Brightspace**: boxy, dated, institutional, hard outlines everywhere.
- **Don't** ship **generic SaaS dashboard** patterns: hero-metric templates, gradient cards, confetti illustrations.
- **Don't** use `#000` or `#fff`, or any untinted neutral.
- **Don't** use gradient text (`background-clip: text`) or `border-left`/`border-right` colour stripes as accents.
- **Don't** nest cards inside cards, or wrap content in a container that doesn't need one.
- **Don't** add a second decorative accent colour or restyle a heading to the mono face.
- **Don't** use hard offset "stamp" shadows; the system moved to soft diffuse elevation on purpose.
- **Don't** add confirmation dialogs for non-destructive actions; speed over ceremony.
