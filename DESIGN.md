---
version: alpha
name: Notion-design-analysis
description: Notion presents itself as the all-in-one workspace through a confident, illustration-rich brand voice — anchored by a deep navy hero band ({colors.brand-navy}) decorated with brand-colored sticky-note dots and mesh wire illustrations, a signature purple pill primary CTA ({colors.primary}), and a rich palette of pastel-tinted feature cards that echo the colorful database properties of the live product. The system uses a Notion-Sans (Inter-based) typeface across every UI surface, anchors a 4-tier pricing comparison (Free / Plus / Business / Enterprise), and presents the live workspace UI mockup directly inside the hero band. Coverage spans homepage, Enterprise, Product AI, Product Agents, Startups, and Pricing surfaces.

colors:
  primary: "#5645d4"
  primary-pressed: "#4534b3"
  primary-deep: "#3a2a99"
  on-primary: "#ffffff"
  brand-navy: "#0a1530"
  brand-navy-deep: "#070f24"
  brand-navy-mid: "#1a2a52"
  link-blue: "#0075de"
  link-blue-pressed: "#005bab"
  brand-orange: "#dd5b00"
  brand-orange-deep: "#793400"
  brand-pink: "#ff64c8"
  brand-pink-deep: "#a02e6d"
  brand-purple: "#7b3ff2"
  brand-purple-300: "#d6b6f6"
  brand-purple-800: "#391c57"
  brand-teal: "#2a9d99"
  brand-green: "#1aae39"
  brand-yellow: "#f5d75e"
  brand-brown: "#523410"
  card-tint-peach: "#ffe8d4"
  card-tint-rose: "#fde0ec"
  card-tint-mint: "#d9f3e1"
  card-tint-lavender: "#e6e0f5"
  card-tint-sky: "#dcecfa"
  card-tint-yellow: "#fef7d6"
  card-tint-yellow-bold: "#f9e79f"
  card-tint-cream: "#f8f5e8"
  card-tint-gray: "#f0eeec"
  canvas: "#ffffff"
  surface: "#f6f5f4"
  surface-soft: "#fafaf9"
  hairline: "#e5e3df"
  hairline-soft: "#ede9e4"
  hairline-strong: "#c8c4be"
  ink-deep: "#000000"
  ink: "#1a1a1a"
  charcoal: "#37352f"
  slate: "#5d5b54"
  steel: "#787671"
  stone: "#a4a097"
  muted: "#bbb8b1"
  on-dark: "#ffffff"
  on-dark-muted: "#a4a097"
  semantic-success: "#1aae39"
  semantic-warning: "#dd5b00"
  semantic-error: "#e03131"

typography:
  hero-display:
    fontFamily: Notion Sans
    fontSize: 80px
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: -2px
  display-lg:
    fontFamily: Notion Sans
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.10
    letterSpacing: -1px
  heading-1:
    fontFamily: Notion Sans
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.5px
  heading-2:
    fontFamily: Notion Sans
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.5px
  heading-3:
    fontFamily: Notion Sans
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.25
  heading-4:
    fontFamily: Notion Sans
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.30
  heading-5:
    fontFamily: Notion Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.40
  subtitle:
    fontFamily: Notion Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.50
  body-md:
    fontFamily: Notion Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-md-medium:
    fontFamily: Notion Sans
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.55
  body-sm:
    fontFamily: Notion Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
  body-sm-medium:
    fontFamily: Notion Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.50
  caption:
    fontFamily: Notion Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.40
  caption-bold:
    fontFamily: Notion Sans
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.40
  micro:
    fontFamily: Notion Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.40
  micro-uppercase:
    fontFamily: Notion Sans
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.40
    letterSpacing: 1px
  button-md:
    fontFamily: Notion Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.30

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 20px
  xxxl: 24px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  xxxl: 40px
  section-sm: 48px
  section: 64px
  section-lg: 96px
  hero: 120px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
  button-primary-disabled:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.muted}"
  button-dark:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    border: "1px solid {colors.hairline-strong}"
  button-on-dark:
    backgroundColor: "{colors.on-dark}"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-secondary-on-dark:
    backgroundColor: "transparent"
    textColor: "{colors.on-dark}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
    border: "1px solid {colors.on-dark-muted}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.link-blue}"
    typography: "{typography.body-sm-medium}"
    padding: "0"
  card-base:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    border: "1px solid {colors.hairline}"
  card-feature:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
    border: "1px solid {colors.hairline}"
  card-feature-yellow-bold:
    backgroundColor: "{colors.card-tint-yellow-bold}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  card-feature-peach:
    backgroundColor: "{colors.card-tint-peach}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  card-feature-rose:
    backgroundColor: "{colors.card-tint-rose}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  card-feature-mint:
    backgroundColor: "{colors.card-tint-mint}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  card-feature-sky:
    backgroundColor: "{colors.card-tint-sky}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  card-feature-lavender:
    backgroundColor: "{colors.card-tint-lavender}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  card-feature-yellow:
    backgroundColor: "{colors.card-tint-yellow}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  card-feature-cream:
    backgroundColor: "{colors.card-tint-cream}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  card-agent-tile:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    border: "1px solid {colors.hairline}"
  card-template:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    border: "1px solid {colors.hairline}"
  card-startup-perk:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
    border: "1px solid {colors.hairline}"
  pricing-card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
    border: "1px solid {colors.hairline}"
  pricing-card-featured:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
    border: "2px solid {colors.primary}"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
    border: "1px solid {colors.hairline-strong}"
    height: 44px
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    border: "2px solid {colors.primary}"
  search-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.steel}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
    height: 44px
    border: "1px solid {colors.hairline}"
  pill-tab:
    backgroundColor: "transparent"
    textColor: "{colors.steel}"
    typography: "{typography.body-sm-medium}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs} {spacing.md}"
    border: "1px solid {colors.hairline}"
  pill-tab-active:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.full}"
    border: "1px solid {colors.ink-deep}"
  segmented-tab:
    backgroundColor: "transparent"
    textColor: "{colors.steel}"
    typography: "{typography.body-sm-medium}"
    padding: "{spacing.sm} {spacing.md}"
    border: "0 0 2px transparent solid"
  segmented-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm-medium}"
    border: "0 0 2px {colors.ink} solid"
  badge-purple:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-pink:
    backgroundColor: "{colors.brand-pink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-orange:
    backgroundColor: "{colors.brand-orange}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-tag-purple:
    backgroundColor: "{colors.card-tint-lavender}"
    textColor: "{colors.brand-purple-800}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-tag-orange:
    backgroundColor: "{colors.card-tint-peach}"
    textColor: "{colors.brand-orange-deep}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-tag-green:
    backgroundColor: "{colors.card-tint-mint}"
    textColor: "{colors.brand-green}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-popular:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.caption-bold}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  promo-banner:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm-medium}"
    padding: "{spacing.sm} {spacing.md}"
  hero-band-dark:
    backgroundColor: "{colors.brand-navy}"
    textColor: "{colors.on-dark}"
    rounded: "0"
    padding: "{spacing.hero}"
  workspace-mockup-card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "0"
    border: "1px solid {colors.hairline}"
    shadow: "rgba(15, 15, 15, 0.2) 0px 24px 48px -8px"
  cta-banner-light:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.section}"
  comparison-table:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    border: "1px solid {colors.hairline}"
  comparison-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    padding: "{spacing.md} {spacing.lg}"
    border: "0 0 1px {colors.hairline-soft} solid"
  testimonial-card:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
    border: "1px solid {colors.hairline}"
  logo-wall-item:
    backgroundColor: "transparent"
    textColor: "{colors.steel}"
    typography: "{typography.body-md-medium}"
    padding: "{spacing.lg}"
  faq-accordion-item:
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "{spacing.xl}"
    border: "0 0 1px {colors.hairline} solid"
  stat-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.section-sm}"
  footer-region:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.charcoal}"
    typography: "{typography.body-sm}"
    padding: "{spacing.section} {spacing.xxl}"
    border: "1px solid {colors.hairline}"
  footer-link:
    backgroundColor: "transparent"
    textColor: "{colors.steel}"
    typography: "{typography.body-sm}"
    padding: "{spacing.xxs} 0"
---

## Overview

Notion presents itself as the all-in-one workspace through a confident, illustration-rich brand voice. The homepage opens with **"Meet the night shift."** rendered centered over a deep navy hero band ({colors.brand-navy}), decorated with brand-colored sticky-note dots and mesh wire illustrations scattered around the headline. The signature **purple pill primary CTA** ({colors.primary}) "Get Notion free" sits at the visual center, paired with an outlined "Request a demo" secondary. Below the buttons, a real Notion workspace UI mockup card (the "Ramp HQ" kanban board) breaks out of the hero band with a deep diffuse drop shadow.

Below the hero, the page cycles through a distinctive sequence of feature sections: a dense sticky-note "Keep work moving 24/7" panel with red/blue/green/purple/teal status icons; a **bold yellow** ({colors.card-tint-yellow-bold}) "Ask your on-demand assistants" banner card flanked by orange/rose/mint pastel feature tiles showing assistant UI mockups; and a "Bring all your work together" 3-column grid with brand-colored mockups (sky-blue tutorial card, light Notion calendar, brown/rust testimonial slate). The pricing page renders 4 tiers (Free / Plus / Business / Enterprise) horizontally with one tier featured (purple-bordered) and a dense feature comparison table running below.

The system uses a Notion-Sans typeface (Inter-based) across every UI surface — humanist-geometric character that pairs naturally with the colorful illustrations. Buttons are `{rounded.md}` (8px) rectangles, NOT pills — distinguishing Notion's sober rectangular geometry from competitors that use pills universally. Cards use `{rounded.lg}` (12px) consistently.

**Key Characteristics:**
- Deep navy hero band ({colors.brand-navy}) with scattered sticky-note dots + mesh wire decorative illustrations
- **Signature purple pill** ({colors.primary}) primary CTA — Notion's recognizable "Get Notion free" button color
- Real Notion workspace UI mockup card embedded in the hero with deep drop shadow
- Bold yellow feature banner ({colors.card-tint-yellow-bold}) for high-emphasis content sections
- Pastel feature card palette (peach, rose, mint, lavender, sky, yellow) echoing the live product database properties
- Notion-Sans (Inter-based) across every UI surface
- 8px-rounded buttons (NOT pills), 12px-rounded cards — sober editorial geometry
- 4-tier pricing comparison with dense feature table
- Centered hero layout (different from the left-aligned norm of most B2B SaaS)

## Colors

> Source pages: notion.com/ (homepage), /enterprise, /product/ai, /product/agents, /startups, /pricing. Token coverage was identical across all six pages.

### Brand & Primary
- **Notion Purple** ({colors.primary}): Signature primary CTA color — the unmistakable "Get Notion free" pill button. Reserved for the dominant CTA only.
- **Purple Pressed** ({colors.primary-pressed}): Pressed-state variant
- **Purple Deep** ({colors.primary-deep}): Deeper variant for emphasis
- **Brand Navy** ({colors.brand-navy}): Hero band background — deep navy
- **Brand Navy Deep** ({colors.brand-navy-deep}): Deeper navy for promo banner
- **Brand Navy Mid** ({colors.brand-navy-mid}): Mid-spectrum navy
- **Link Blue** ({colors.link-blue}): Inline text link blue (NOT primary CTA)
- **Link Blue Pressed** ({colors.link-blue-pressed}): Pressed-state link blue

### Brand Color Spectrum (echoes live product database properties)
- **Brand Pink** ({colors.brand-pink}): Pink accent
- **Brand Pink Deep** ({colors.brand-pink-deep}): Deeper pink
- **Brand Orange** ({colors.brand-orange}): Orange accent
- **Brand Orange Deep** ({colors.brand-orange-deep}): Deeper orange-rust
- **Brand Purple** ({colors.brand-purple}): Purple accent variant
- **Brand Purple 300** ({colors.brand-purple-300}): Light purple
- **Brand Purple 800** ({colors.brand-purple-800}): Deep purple for tag text
- **Brand Teal** ({colors.brand-teal}): Teal accent
- **Brand Green** ({colors.brand-green}): Bright green
- **Brand Yellow** ({colors.brand-yellow}): Soft yellow
- **Brand Brown** ({colors.brand-brown}): Brand brown for "earthy" tints

### Card Tints (Pastel Feature Card Backgrounds)
- **Tint Peach** ({colors.card-tint-peach}): Pale peach
- **Tint Rose** ({colors.card-tint-rose}): Pale rose-pink
- **Tint Mint** ({colors.card-tint-mint}): Pale mint-green
- **Tint Lavender** ({colors.card-tint-lavender}): Pale lavender
- **Tint Sky** ({colors.card-tint-sky}): Pale sky-blue
- **Tint Yellow** ({colors.card-tint-yellow}): Pale yellow
- **Tint Yellow Bold** ({colors.card-tint-yellow-bold}): Bold yellow for high-emphasis feature banners ("Ask your on-demand assistants")
- **Tint Cream** ({colors.card-tint-cream}): Cream tint
- **Tint Gray** ({colors.card-tint-gray}): Neutral surface

### Surface
- **Canvas White** ({colors.canvas}): Page background and primary card surface
- **Surface** ({colors.surface}): Subtle section backgrounds, search-pill rest, featured pricing tier
- **Surface Soft** ({colors.surface-soft}): Quieter section divisions
- **Hairline** ({colors.hairline}): 1px borders and primary dividers
- **Hairline Soft** ({colors.hairline-soft}): Quieter dividers
- **Hairline Strong** ({colors.hairline-strong}): Stronger 1px border for inputs

### Text
- **Ink Deep** ({colors.ink-deep}): Pure black for emphasis
- **Ink** ({colors.ink}): Primary headlines and body text
- **Charcoal** ({colors.charcoal}): Body emphasis (Notion's signature warm-charcoal)
- **Slate** ({colors.slate}): Secondary text
- **Steel** ({colors.steel}): Tertiary, footer links
- **Stone** ({colors.stone}): Muted labels
- **Muted** ({colors.muted}): Disabled, placeholders
- **On Dark** ({colors.on-dark}): White text on dark surfaces
- **On Dark Muted** ({colors.on-dark-muted}): Reduced-opacity white

### Semantic
- **Success** ({colors.semantic-success}): Confirmation green
- **Warning** ({colors.semantic-warning}): Mid-priority alerts (orange)
- **Error** ({colors.semantic-error}): Validation errors (red)

## Typography

### Font Family
**Notion Sans** (primary): Notion's custom Inter-based variable typeface. Fallbacks: Inter, -apple-system, system-ui, 'Segoe UI', Helvetica, sans-serif. Humanist-geometric character used across every UI surface.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.hero-display}` | 80px | 600 | 1.05 | -2px | Hero ("Meet the night shift") |
| `{typography.display-lg}` | 56px | 600 | 1.10 | -1px | Section openers |
| `{typography.heading-1}` | 48px | 600 | 1.15 | -0.5px | Page-level headlines ("Try for free") |
| `{typography.heading-2}` | 36px | 600 | 1.20 | -0.5px | Subsection headlines ("Keep work moving 24/7") |
| `{typography.heading-3}` | 28px | 600 | 1.25 | 0 | Card titles |
| `{typography.heading-4}` | 22px | 600 | 1.30 | 0 | Feature tile titles |
| `{typography.heading-5}` | 18px | 600 | 1.40 | 0 | FAQ questions |
| `{typography.subtitle}` | 18px | 400 | 1.50 | 0 | Hero subtitle |
| `{typography.body-md}` | 16px | 400 | 1.55 | 0 | Primary body text |
| `{typography.body-md-medium}` | 16px | 500 | 1.55 | 0 | Body emphasis |
| `{typography.body-sm}` | 14px | 400 | 1.50 | 0 | Secondary body |
| `{typography.body-sm-medium}` | 14px | 500 | 1.50 | 0 | Active sidebar, button labels |
| `{typography.caption-bold}` | 13px | 600 | 1.40 | 0 | Badge labels |
| `{typography.button-md}` | 14px | 500 | 1.30 | 0 | Button labels |

### Principles
- Tight hero leading (1.05) on 80px display
- Negative letter-spacing on display sizes (-2px to -0.5px)
- Generous body leading (1.55) for documentation readability
- 600 weight for headlines + 500 for buttons; 400 body

## Layout

### Spacing System
- **Base unit**: 4px (8px primary increment)
- **Tokens**: `{spacing.xxs}` (4px) through `{spacing.hero}` (120px)
- **Section rhythm**: Marketing pages use `{spacing.section-lg}` (96px); pricing tightens to `{spacing.section}` (64px)

### Grid & Container
- 1280px max-width with 32px gutters
- Pricing: 4-tier card row at desktop with dense comparison table
- Homepage: centered hero with workspace mockup below buttons; alternating colorful feature card sections

### Whitespace Philosophy
Marketing surfaces use generous breathing room between feature card bands. Workspace mockup card on hero gets full-width treatment with deep drop shadow.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | No shadow; `{colors.hairline}` border | Default cards, table rows |
| 1 (subtle) | `rgba(15, 15, 15, 0.04) 0px 1px 2px 0px` | Hover-elevated tiles |
| 2 (card) | `rgba(15, 15, 15, 0.08) 0px 4px 12px 0px` | Feature cards |
| 3 (mockup) | `rgba(15, 15, 15, 0.20) 0px 24px 48px -8px` | Hero workspace mockup card |
| 4 (modal) | `rgba(15, 15, 15, 0.16) 0px 16px 48px -8px` | Modals, dropdowns |

### Decorative Depth
- Hero workspace mockup card uses deep diffuse drop shadow (Level 3) — significant elevation against the navy band
- Pastel feature cards carry their own visual weight via tint backgrounds
- Sticky-note dot illustrations and mesh wires add atmospheric decoration to navy hero

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Tag chips |
| `{rounded.sm}` | 6px | Type badges |
| `{rounded.md}` | 8px | Buttons, inputs, search-pill |
| `{rounded.lg}` | 12px | Cards, pricing tiers, agent tiles, workspace mockup |
| `{rounded.xl}` | 16px | Larger feature panels |
| `{rounded.xxl}` | 20px | Featured product showcases |
| `{rounded.xxxl}` | 24px | Larger feature cards |
| `{rounded.full}` | 9999px | Status badges, pill tabs (NOT regular buttons) |

Notion's geometry is sober-editorial — `{rounded.md}` (8px) buttons distinguish it from pill-button-everywhere brands.

## Components

> Per the no-hover policy, hover states are NOT documented.

### Buttons

**`button-primary`** — Signature purple rectangular primary CTA, the dominant action.
- Background `{colors.primary}`, text `{colors.on-primary}`, typography `{typography.button-md}`, padding `10px 18px`, rounded `{rounded.md}`.
- Pressed state `button-primary-pressed` deepens to `{colors.primary-pressed}`.
- Disabled state uses `{colors.hairline}` background.

**`button-dark`** — Black rectangular CTA on light backgrounds.
- Background `{colors.ink-deep}`, text `{colors.on-dark}`, typography `{typography.button-md}`, padding `10px 18px`, rounded `{rounded.md}`.

**`button-secondary`** — Outlined rectangular for secondary actions ("Request a demo").
- Background transparent, text `{colors.ink}`, border `1px solid {colors.hairline-strong}`, typography `{typography.button-md}`, padding `10px 18px`, rounded `{rounded.md}`.

**`button-on-dark`** — White button on dark hero bands.
- Background `{colors.on-dark}`, text `{colors.ink}`, typography `{typography.button-md}`, padding `10px 18px`, rounded `{rounded.md}`.

**`button-secondary-on-dark`** — Outlined button on dark.
- Background transparent, text `{colors.on-dark}`, border `1px solid {colors.on-dark-muted}`, typography `{typography.button-md}`, padding `10px 18px`, rounded `{rounded.md}`.

**`button-ghost`** — Quieter ghost button.
- Background transparent, text `{colors.ink}`, typography `{typography.button-md}`, padding `8px 12px`, rounded `{rounded.sm}`.

**`button-link`** — Inline blue text link (NOT primary purple).
- Background transparent, text `{colors.link-blue}`, typography `{typography.body-sm-medium}`, padding `0`.

### Cards & Containers

**`card-base`** — Standard content card.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.xl}`, border `1px solid {colors.hairline}`.

**`card-feature`** — Feature card with larger padding.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.xxl}`, border `1px solid {colors.hairline}`.

**`card-feature-yellow-bold`** — Bold yellow feature banner for high-emphasis content ("Ask your on-demand assistants").
- Background `{colors.card-tint-yellow-bold}`, text `{colors.charcoal}`, rounded `{rounded.lg}`, padding `{spacing.xxl}`.

**`card-feature-peach`** + **`card-feature-rose`** + **`card-feature-mint`** + **`card-feature-sky`** + **`card-feature-lavender`** + **`card-feature-yellow`** + **`card-feature-cream`** — Pastel-tinted feature cards.
- Each variant uses its corresponding `card-tint-*` color as background, text `{colors.charcoal}`, rounded `{rounded.lg}`, padding `{spacing.xxl}`.

**`card-agent-tile`** — Agent assistant tile.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.xl}`, border `1px solid {colors.hairline}`.

**`card-template`** — Template thumbnail card.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.lg}`, border `1px solid {colors.hairline}`.

**`card-startup-perk`** — Startup-program perk grid item.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.xl}`, border `1px solid {colors.hairline}`.

**`pricing-card`** — Standard pricing tier card.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.xxl}`, border `1px solid {colors.hairline}`.

**`pricing-card-featured`** — Featured pricing tier (Plus or Business — purple-bordered).
- Background `{colors.surface}`, rounded `{rounded.lg}`, padding `{spacing.xxl}`, border `2px solid {colors.primary}`.

### Inputs & Forms

**`text-input`** — Standard text field.
- Background `{colors.canvas}`, text `{colors.ink}`, border `1px solid {colors.hairline-strong}`, rounded `{rounded.md}`, padding `{spacing.sm} {spacing.md}`, height 44px.

**`text-input-focused`** — Activated state.
- Border switches to `2px solid {colors.primary}` (purple).

**`search-pill`** — Search bar.
- Background `{colors.surface}`, text `{colors.steel}`, typography `{typography.body-md}`, rounded `{rounded.md}`, height 44px, border `1px solid {colors.hairline}`.

### Tabs

**`pill-tab`** + **`pill-tab-active`** — Pill-style tab nav for top-level switching.
- Inactive: text `{colors.steel}`, border `1px solid {colors.hairline}`, padding `{spacing.xs} {spacing.md}`, rounded `{rounded.full}`.
- Active: background `{colors.ink-deep}`, text `{colors.on-dark}`.

**`segmented-tab`** + **`segmented-tab-active`** — Underline-style tab navigation.
- Inactive: text `{colors.steel}`, no border. Active: text `{colors.ink}`, 2px bottom border in `{colors.ink}`.

### Badges & Status

**`badge-purple`** — Purple status badge (matches primary CTA).
- Background `{colors.primary}`, text `{colors.on-primary}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`, padding `4px 10px`.

**`badge-pink`** — Pink accent badge.
- Background `{colors.brand-pink}`, text `{colors.on-primary}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`, padding `4px 10px`.

**`badge-orange`** — Orange accent badge.
- Background `{colors.brand-orange}`, text `{colors.on-primary}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`, padding `4px 10px`.

**`badge-tag-purple`** — Soft-purple feature tag chip.
- Background `{colors.card-tint-lavender}`, text `{colors.brand-purple-800}`, typography `{typography.caption-bold}`, rounded `{rounded.sm}`, padding `2px 8px`.

**`badge-tag-orange`** — Soft-orange feature tag.
- Background `{colors.card-tint-peach}`, text `{colors.brand-orange-deep}`, typography `{typography.caption-bold}`, rounded `{rounded.sm}`, padding `2px 8px`.

**`badge-tag-green`** — Soft-mint feature tag.
- Background `{colors.card-tint-mint}`, text `{colors.brand-green}`, typography `{typography.caption-bold}`, rounded `{rounded.sm}`, padding `2px 8px`.

**`badge-popular`** — "Most Popular" tier indicator.
- Background `{colors.primary}`, text `{colors.on-primary}`, typography `{typography.caption-bold}`, rounded `{rounded.full}`, padding `4px 10px`.

**`promo-banner`** — Light surface promo strip ABOVE the top nav.
- Background `{colors.surface}`, text `{colors.ink}`, typography `{typography.body-sm-medium}`, padding `{spacing.sm} {spacing.md}`. ("Developers: Get a first look at our new Developer Platform on May 13.")

### Tables

**`comparison-table`** — Pricing feature comparison table.
- Background `{colors.canvas}`, text `{colors.ink}`, typography `{typography.body-sm}`, rounded `{rounded.md}`, border `1px solid {colors.hairline}`.

**`comparison-row`** — Individual feature row.
- Background `{colors.canvas}`, text `{colors.ink}`, padding `{spacing.md} {spacing.lg}`, bottom border `1px solid {colors.hairline-soft}`.

### Documentation Components

**`workspace-mockup-card`** — Embedded Notion workspace UI mockup on hero band ("Ramp HQ" kanban board).
- Background `{colors.canvas}`, rounded `{rounded.lg}`, border `1px solid {colors.hairline}`, deep shadow `rgba(15, 15, 15, 0.20) 0px 24px 48px -8px`. Carries actual Notion product UI mock.

**`testimonial-card`** — Customer testimonial card.
- Background `{colors.canvas}`, rounded `{rounded.lg}`, padding `{spacing.xxl}`, border `1px solid {colors.hairline}`.

**`logo-wall-item`** — Customer logo wordmark cell.
- Background transparent, text `{colors.steel}`, typography `{typography.body-md-medium}`, padding `{spacing.lg}`.

**`faq-accordion-item`** — FAQ panel.
- Background `{colors.canvas}`, rounded `{rounded.md}`, padding `{spacing.xl}`, bottom border `1px solid {colors.hairline}`.

**`stat-row`** — Stats strip with bar chart visualization ("More productivity. Fewer tools.").
- Background `{colors.surface}`, text `{colors.ink}`, rounded `{rounded.lg}`, padding `{spacing.section-sm}`.

**`cta-banner-light`** — Light surface CTA banner.
- Background `{colors.surface}`, text `{colors.ink}`, rounded `{rounded.lg}`, padding `{spacing.section}`.

### Navigation

**Top Navigation (Marketing)** — Sticky white bar.
- Background `{colors.canvas}`, height ~64px, bottom border `1px solid {colors.hairline}`.
- Left: Notion "N" logo + "Product / AI / Solutions / Resources / Enterprise / Pricing / Request a demo" links.
- Right: "Get Notion free" purple button + "Log in" link.

### Signature Components

**`hero-band-dark`** — Deep navy hero band with embedded workspace mockup and decorative dots/wires.
- Background `{colors.brand-navy}`, text `{colors.on-dark}`, padding `{spacing.hero}`.
- Layout: centered headline `{typography.hero-display}`, subtitle, button row (`button-primary` purple + `button-secondary-on-dark`), `workspace-mockup-card` below.
- Atmospheric decoration: scattered colorful sticky-note dots and mesh wire illustrations around the hero content (NOT a literal pattern fill — handled per-page via SVG/illustration).

**`footer-region`** — Multi-column light footer.
- Background `{colors.canvas}`, padding `{spacing.section} {spacing.xxl}`, top border `1px solid {colors.hairline}`.
- 6-column link grid (Product / Download / Resources / Notion for / Company / Legal).

**`footer-link`** — Individual footer link.
- Background transparent, text `{colors.steel}`, typography `{typography.body-sm}`, padding `{spacing.xxs} 0`.

## Do's and Don'ts

### Do
- Use `{colors.primary}` (purple) as the dominant CTA across all surfaces — it's the brand's recognizable signal
- Pair deep navy hero bands ({colors.brand-navy}) with the purple button + decorative sticky-note dots
- Use pastel feature card tints (peach, rose, mint, lavender, sky, yellow) generously
- Use `{colors.card-tint-yellow-bold}` for high-emphasis "Ask the assistant"-style banner cards
- Apply `{rounded.md}` (8px) to buttons consistently — Notion uses rectangles, not pills
- Apply `{rounded.lg}` (12px) to all card families
- Maintain Notion-Sans across every UI surface
- Use the workspace mockup card on hero bands to show actual product UI

### Don't
- Don't use the purple for body text or large background surfaces
- Don't use pill-shaped buttons; Notion's geometry is rectangular-sober
- Don't mix link-blue ({colors.link-blue}) with primary-purple ({colors.primary}) — they have distinct roles
- Don't apply heavy shadows on flat documentation cards
- Don't replace Notion-Sans with a generic Inter

## Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|---|---|---|
| Mobile (small) | < 480px | Single column. Hero 36px. Pricing 1-up. |
| Mobile (large) | 480 – 767px | Feature cards 2-up. Hero 48px. |
| Tablet | 768 – 1023px | 2-column feature grids. Hero 56px. |
| Desktop | 1024 – 1279px | 4-tier pricing card row. Hero 72px. |
| Wide Desktop | ≥ 1280px | Full 80px hero presentation. |

### Touch Targets
- Buttons render at 40–44px effective height
- Form inputs render at 44px height
- Pill tabs ~32px → 44px on mobile

### Collapsing Strategy
- **Promo banner** stays full-width; truncates at < 480px
- **Top nav** below 1024px collapses to hamburger
- **Hero band**: workspace mockup card moves below text/buttons on mobile
- **Pricing tiers**: 4-column → 2-column tablet → 1-column mobile
- **Feature cards**: 3-up desktop → 2-up tablet → 1-up mobile
- **Hero typography**: 80px → 56px → 48px → 36px
- **Footer**: 6-column desktop → 3-column tablet → accordion mobile

### Image Behavior
- Workspace mockup card maintains aspect ratio
- Pastel illustrations inside feature cards scale proportionally
- Customer logo wall: wordmarks at consistent 60–80px height

## Iteration Guide

1. Focus on ONE component at a time
2. Reference component names and tokens directly
3. Run `npx @google/design.md lint DESIGN.md` after edits
4. Add new variants as separate `components:` entries
5. Default to `{typography.body-md}` for body
6. Keep `{colors.primary}` (purple) as the primary CTA — distinct from `{colors.link-blue}` for inline links
7. Use `{rounded.md}` for buttons (rectangles), `{rounded.lg}` for cards, `{rounded.full}` for pill tabs/badges only

## Known Gaps

- Specific dark-mode token values not surfaced beyond hero bands
- Animation/transition timings not extracted; recommend 150–200ms ease
- Form validation success state not explicitly captured
- Pastel-tint mapping (which feature uses which tint) is observation-based — the actual brand library may have more entries

---
---

# LifeKeeper App 增补章节（2026-10-06 追加，项目专用）

> 本章节是 LifeKeeper **应用界面**（非营销页）的专用规范，与前文 Token 具有同等效力。规则只引用前文已定义的 Token，**不新增任何颜色、字号、圆角、阴影**；如与前文营销页描述发生冲突，以本章节为准。

## A. 适用范围、字体与停用清单

1. **产品形态**：LifeKeeper 是浅色工具型单页应用。MVP **只做浅色模式**；深色模式列入后续 Backlog，在深色 Token 正式定义之前，禁止编码时自行推导深色值。
2. **字体**：Notion Sans 不可自由分发，实际使用其 fallback 链中的 **Inter**，字体文件下载到 `assets/fonts/` 本地引入（离线可用）；fallback：`Inter, -apple-system, system-ui, 'Segoe UI', Helvetica, sans-serif`。
3. **本项目停用的营销组件**（禁止在页面中出现）：`hero-band-dark`、`pricing-card` / `pricing-card-featured`、`testimonial-card`、`faq-accordion-item`、`logo-wall-item`、营销页顶部导航、`footer-region` / `footer-link`、`promo-banner`、`cta-banner-light`、`card-template`、`card-startup-perk`。
4. **按钮几何**：所有可点击按钮遵循前文 `button-*` 规范，使用 `{rounded.md}`（8px）圆角矩形；`{rounded.full}` 仅允许用于状态徽章、`pill-tab` 与圆形图标按钮（含移动端悬浮按钮），**不得把常规按钮做成胶囊形**。

## B. 应用外壳（App Shell）

### B.1 桌面 / 平板左侧导航栏

| 项 | 规则 |
|---|---|
| 宽度 | 桌面（≥1024px）固定 **240px**；平板（640–1023px）折叠为 **72px 图标栏**；手机（<640px）隐藏，改用底部 Tab 栏 |
| 背景 / 分割 | 背景 `{colors.surface}`，右侧 1px `{colors.hairline}` 边框 |
| 品牌区 | 高度 64px，左侧产品标志 + 「LifeKeeper」文字（`{typography.heading-5}`，`{colors.charcoal}`）；折叠态仅显示标志 |
| 导航条目 | 高度 40px，左右内边距 `{spacing.md}`，圆角 `{rounded.sm}`；图标 18px、与文字间距 `{spacing.sm}`；文字 `{typography.body-sm-medium}` |
| 条目顺序 | 仪表盘、日常收支、生活记录、物品台账、密码保管；「设置」固定在导航栏底部 |
| 默认态 | 文字与图标 `{colors.slate}`，背景透明 |
| 悬停态 | 背景 `{colors.hairline-soft}` |
| **选中态** | 背景 `{colors.card-tint-lavender}`，文字与图标 `{colors.brand-purple-800}` |

### B.2 主区域

- 背景 `{colors.canvas}`；内容区最大宽度 **1200px** 居中，内边距：桌面 `{spacing.xxl}`（32px）、手机 `{spacing.lg}`（20px）；卡片之间间距 `{spacing.xl}`（24px）。
- 顶栏高度 64px，底部 1px `{colors.hairline}`；左侧为页面标题 / 问候语（`{typography.heading-4}`，`{colors.charcoal}`）与下方日期（`{typography.caption-bold}`，`{colors.steel}`）；右侧依次为 `search-pill`、锁定图标按钮、头像（36px 圆形）。

### B.3 移动端底部 Tab 栏与悬浮按钮

- 底部 Tab 栏：高度 64px（含安全区），背景 `{colors.canvas}`，顶部 1px `{colors.hairline}`；5 个条目（仪表盘、收支、记录、物品、我的），图标 22px + 11px 文字；默认 `{colors.steel}`，选中 `{colors.primary}`。
- 悬浮「记一笔」按钮：56px 圆形，背景 `{colors.primary}`，白色加号图标，定位在 Tab 栏上方右侧 20px；阴影使用 Elevation Level 4（modal）；点击反馈缩放 0.95。

## C. 列表行（流水 / 日记 / 物品 / 账号通用）

| 组成 | 规则 |
|---|---|
| 行内边距 | `{spacing.sm}`（12px）`{spacing.md}`（16px） |
| 左侧图标 | 36px 圆角 `{rounded.md}` 容器，背景使用对应淡彩色（`card-tint-*`），图标 18px，颜色用对应深色（参照 `badge-tag-*` 配色） |
| 主文本 | `{typography.body-md-medium}`，`{colors.charcoal}`，单行溢出省略 |
| 副文本 | `{typography.body-sm}`，`{colors.steel}`（如分类、位置、账号） |
| 右侧主值 | `{typography.body-md-medium}`：支出 `{colors.semantic-error}`、收入 `{colors.brand-green}`；账号 / 物品行无金额时不显示 |
| 右侧次值 | `{typography.caption-bold}`，`{colors.steel}`（日期 / 数量） |
| 分割线 | 行底部 1px `{colors.hairline-soft}`；最后一行不显示 |
| 悬停 | 背景 `{colors.surface-soft}`；可点击行光标 pointer |

## D. 三张统计卡片（仪表盘）

卡片统一圆角 `{rounded.lg}`、1px `{colors.hairline}` 边框、内边距 `{spacing.xl}`；标题 `{typography.body-sm}`（`{colors.slate}`），数字 `{typography.heading-2}` 字重 600。

| 卡片 | 背景 | 数字颜色 | 角标图标 / 趋势小字 |
|---|---|---|---|
| 本月收入 | `{colors.card-tint-mint}` | `{colors.charcoal}` | 图标 `{colors.brand-green}`；上升趋势文字 `{colors.brand-green}` |
| 本月支出 | `{colors.surface}` | `{colors.charcoal}` | 图标 `{colors.semantic-error}`；上升趋势文字 `{colors.semantic-error}` |
| 本月结余 | `{colors.card-tint-lavender}` | `{colors.brand-purple-800}` | 图标 `{colors.primary}` |

> 数字不直接使用亮绿 / 亮红，保证在淡彩底上的对比度；颜色语义通过底色与角标传达。

## E. 弹窗、Toast、空状态

### E.1 Modal 弹窗
- 遮罩：`rgba(15, 15, 15, 0.40)`；面板：背景 `{colors.canvas}`，圆角 `{rounded.lg}`，宽度 480px（表单类），阴影 Elevation Level 4。
- 结构：头部标题 `{typography.heading-5}`（`{colors.charcoal}`）+ 右上角 ghost 关闭按钮；正文内边距 `{spacing.xxl}`；底部右对齐操作按钮，主按钮在最右。
- 手机端：改为底部弹出（bottom sheet），顶部圆角 `{rounded.xl}`，宽度撑满。

### E.2 Toast 轻提示
- 背景 `{colors.ink-deep}`，文字 `{colors.on-dark}`（`{typography.body-sm}`），圆角 `{rounded.md}`，阴影 Elevation Level 2；成功提示左侧带 `{colors.brand-green}` 小圆点、错误带 `{colors.semantic-error}` 圆点；显示 2.5 秒自动消失，位置在内容区顶部居中（手机端在 Tab 栏上方）。

### E.3 空状态
- 居中：96px 淡彩圆形容器（`{colors.surface}`）+ 40px 线性图标（`{colors.stone}`）；标题 `{typography.heading-5}`（`{colors.charcoal}`）；说明文字 `{typography.body-sm}`（`{colors.steel}`）；下方一个 8px 矩形主按钮引导首次操作。

## F. 密码模块专用组件

| 组件 | 规则 |
|---|---|
| 密码掩码 | 列表与详情默认以 `•` 掩码显示，使用 `{typography.body-md}`，字距 2px |
| 显隐眼睛 | ghost 图标按钮（18px，`{colors.steel}`，悬停 `{colors.charcoal}`）；点击后明文显示，再次点击恢复掩码 |
| 复制按钮 | ghost 图标按钮；复制成功后图标变为对勾、颜色 `{colors.brand-green}` 持续 1.5 秒，并弹出 Toast「已复制」 |
| 强度条 | 4 段等宽矩形（高 6px，圆角 `{rounded.xs}`，段间距 4px）；由弱到强颜色依次为 `{colors.semantic-error}`、`{colors.semantic-warning}`、`{colors.brand-yellow}`、`{colors.brand-green}`；右侧文字标签「弱 / 中 / 强 / 极强」（`{typography.caption-bold}`） |
| 密码生成器 | 长度滑杆（12–24，滑块与选中值用 `{colors.primary}`）；大写 / 数字 / 符号三个勾选框，勾选态为 `{colors.primary}`；生成结果用等宽风格展示并附复制按钮 |

## G. 图表分类色板（固定 8 色，按顺序循环）

| 顺序 | Token | 用途 |
|---|---|---|
| 1 | `{colors.brand-purple}` | 分类 1 |
| 2 | `{colors.brand-orange}` | 分类 2 |
| 3 | `{colors.brand-teal}` | 分类 3 |
| 4 | `{colors.brand-pink}` | 分类 4 |
| 5 | `{colors.brand-yellow}` | 分类 5（需配深色标签 / 描边） |
| 6 | `{colors.link-blue}` | 分类 6 |
| 7 | `{colors.brand-green}` | 分类 7 |
| 8 | `{colors.brand-brown}` | 分类 8 |

- `{colors.primary}` 是 CTA 专用色，**不进入图表色板**；同一分类在所有图表中颜色必须一致；柱状图未选中柱使用 `{colors.hairline-strong}`，高亮柱使用当前分类色。
- 网格线使用 `{colors.hairline-soft}`；坐标轴文字 `{colors.steel}`（`{typography.caption-bold}`）。

## H. 交互状态、焦点与动效

1. **状态映射**（复用现有 Token，不新增色值）：
   - `button-primary`：hover 用 `{colors.primary-pressed}`，按下用 `{colors.primary-deep}`；disabled 沿用前文（`{colors.hairline}` 底、`{colors.muted}` 字）。
   - `button-secondary` / `button-ghost` / 图标按钮：hover 背景 `{colors.hairline-soft}`。
   - 输入框：focus 沿用 `text-input-focused`（2px `{colors.primary}` 边框）。
2. **焦点环**：键盘导航（`focus-visible`）显示 2px `{colors.primary}` 焦点环 + 2px 透明外间距；鼠标点击不显示。
3. **动效**：颜色 / 背景 / 边框 / 阴影过渡统一 **150–200ms ease**；弹窗出现 200ms（轻微上移 + 淡入），Toast 150ms 淡入；禁用动效偏好（`prefers-reduced-motion`）下取消位移动画。

## I. 应用响应式规则（补充前文营销页断点）

| 断点 | 外壳变化 | 内容变化 |
|---|---|---|
| <640px | 左侧栏 → 底部 Tab 栏 + 悬浮按钮；顶栏搜索框收为图标 | 统计卡片纵向堆叠；弹窗变底部弹出；触控目标 ≥44px |
| 640–1023px | 左侧栏折叠为 72px 图标栏 | 统计卡片 3 列；列表保留双行信息 |
| ≥1024px | 左侧栏 240px 完整展开 | 主区域按非对称网格（列表 2/3 + 侧栏 1/3） |

