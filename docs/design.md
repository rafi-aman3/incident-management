# EHS Incident Management — Design System

**Status:** Living document
**Inspired by:** SmartQHSE (teal/navy enterprise QHSE aesthetic), recolored around brand purple `#735CDD`
**Last updated:** 2026-05-04

This document is the visual contract for the EHS Incident Management app. The product is for safety-critical industries (construction, oil & gas, manufacturing) where users make rapid decisions under regulatory pressure. The design language must feel **calm, authoritative, and trustworthy** — never decorative, never noisy.

When this document and `docs/SPEC.md` §13 disagree, this file wins. Component code (shadcn primitives in `components/ui/`) must match the tokens here.

---

## 1. Visual theme

A purple-to-navy palette grounds the app in enterprise reliability. Brand purple `#735CDD` is the **trust signal** — applied only to primary actions, active states, and brand moments. Navy `#0A2540` carries authority — reserved for headlines, dense data, and focused emphasis. A dedicated success green `#16A34A` carries "safe / verified outcome" semantics that purple cannot. Everything else is a quiet neutral scale designed to disappear so that incident data, severity badges, and regulatory deadlines stand out.

**Atmosphere:** clean, minimal, generous whitespace. Subtle shadows for depth without visual noise. Geometric precision with an 8px-baseline rhythm. The interface should feel modern but not flashy — built for time-pressured EHS managers, not weekend product hunters.

---

## 2. Color palette

### Brand
| Token | Hex | OKLch | Role |
|---|---|---|---|
| `--brand` | `#735CDD` | `oklch(0.554 0.196 285.0)` | Primary CTAs, active states, brand moments |
| `--brand-hover` | `#5E47C8` | `oklch(0.475 0.188 285.0)` | Hover for primary actions |
| `--brand-pressed` | `#4A36AE` | `oklch(0.402 0.180 285.0)` | Active/pressed primary |
| `--brand-soft` | `rgba(115, 92, 221, 0.10)` | — | Brand-tinted background (ghost hover, active sidebar item, info chip) |
| `--accent` | `#00D4FF` | `oklch(0.823 0.139 224.0)` | Reserved (see §11 Suggestions) |
| `--navy` | `#0A2540` | `oklch(0.215 0.044 252.5)` | Headlines, data emphasis (NEVER as background) |

### Neutrals (text + surfaces)
| Token | Hex | OKLch | Role |
|---|---|---|---|
| `--foreground` | `#191919` | `oklch(0.180 0.000 0)` | Body text on light backgrounds (WCAG AAA on white) |
| `--foreground-muted` | `#475569` | `oklch(0.408 0.039 252.0)` | Secondary text, labels (WCAG AA) |
| `--foreground-subtle` | `#6B6B6B` | `oklch(0.475 0.000 0)` | Helper copy, captions, placeholders |
| `--charcoal` | `#1C1913` | `oklch(0.215 0.005 70.0)` | Critical emphasis in tables/warnings |
| `--background` | `#FFFFFF` | `oklch(1.000 0.000 0)` | Card and modal surface |
| `--background-warm` | `#F6F5F4` | `oklch(0.965 0.001 86.0)` | Long-form content backdrop |
| `--background-cool` | `#F8FAFC` | `oklch(0.984 0.003 247.9)` | Page background, secondary surfaces |
| `--surface-hover` | `#E2E8F0` | `oklch(0.913 0.014 248.9)` | Hover, inactive tabs |
| `--border` | `#E5E7EB` | `oklch(0.918 0.005 247.9)` | Default borders, dividers (highest-use token) |
| `--border-strong` | `#CBD5E1` | `oklch(0.842 0.014 248.9)` | Emphasized separation |

### Semantic / status
| Token | Hex | OKLch | Role |
|---|---|---|---|
| `--destructive` | `#DC2626` | `oklch(0.577 0.245 27.4)` | Critical errors, dangerous actions |
| `--destructive-soft` | `#EF4444` | `oklch(0.628 0.226 23.0)` | Secondary error feedback |
| `--warning` | `#F59E0B` | `oklch(0.753 0.165 70.0)` | Non-critical warnings |
| `--warning-amber` | `#F5A623` | `oklch(0.748 0.148 60.0)` | Regulatory compliance callouts |
| `--success` | `#16A34A` | `oklch(0.594 0.158 152.0)` | Closed/verified states. **Distinct from brand purple** — green carries "safe outcome" semantics that purple cannot. |
| `--success-hover` | `#15803D` | `oklch(0.516 0.150 152.0)` | Hover for confirmation buttons (e.g., "Verify Closure") |

### EHS-specific: severity colors (NEW — adapted for our domain)

The PRD defines five severity levels with prescribed colors. We map them onto our palette:

| Severity | Track | Hex | OKLch | Background tint | Visual weight |
|---|---|---|---|---|---|
| **S1 — Critical** | A | `#B91C1C` | `oklch(0.498 0.222 27.0)` | `rgba(185, 28, 28, 0.10)` | Loudest |
| **S2 — Major** | A | `#EA580C` | `oklch(0.643 0.193 39.5)` | `rgba(234, 88, 12, 0.10)` | Loud |
| **S3 — Moderate** | B | `#F59E0B` | `oklch(0.753 0.165 70.0)` | `rgba(245, 158, 11, 0.10)` | Medium |
| **S4 — Minor** | C | `#16A34A` | `oklch(0.594 0.158 152.0)` | `rgba(22, 163, 74, 0.10)` | Quiet |
| **S5 — Insignificant** | C | `#6B7280` | `oklch(0.481 0.013 264.0)` | `rgba(107, 114, 128, 0.10)` | Quietest |

S1 is intentionally **darker, deeper red** than `--destructive` so a critical incident badge reads as "established, recorded fact" rather than an inline form error. S4 uses the dedicated success green (not the brand purple) — closed/safe outcomes need the universally-readable safety green.

### EHS-specific: incident status colors (NEW)
| Status | Background | Foreground |
|---|---|---|
| `draft` | `oklch(0.918 0.005 247.9)` (border) | `oklch(0.408 0.039 252.0)` (muted) |
| `submitted` | `rgba(115, 92, 221, 0.10)` | `oklch(0.475 0.188 285.0)` (brand-hover) |
| `classified` | `rgba(115, 92, 221, 0.16)` | `oklch(0.402 0.180 285.0)` (brand-pressed) |
| `under_investigation` | `rgba(245, 158, 11, 0.10)` | `oklch(0.575 0.135 60.0)` (deep amber) |
| `awaiting_capa` | `rgba(245, 158, 11, 0.16)` | `oklch(0.485 0.125 60.0)` |
| `closed` | `rgba(22, 163, 74, 0.10)` | `oklch(0.516 0.150 152.0)` (success-hover) |

### Dark mode (NEW — not in source spec)

Inverts the lightness while preserving hue. Brand purple shifts up in lightness for visibility on the navy canvas.

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(1.000 0 0)` | `oklch(0.215 0.044 252.5)` _(navy as canvas)_ |
| `--foreground` | `oklch(0.180 0 0)` | `oklch(0.965 0.001 86.0)` |
| `--brand` | `oklch(0.554 0.196 285.0)` | `oklch(0.660 0.180 285.0)` _(lifted lightness for contrast on navy canvas)_ |
| `--success` | `oklch(0.594 0.158 152.0)` | `oklch(0.685 0.155 152.0)` |
| `--border` | `oklch(0.918 0.005 247.9)` | `oklch(1 0 0 / 12%)` |

> **Note:** the source spec explicitly warns "don't use navy as a background." That rule stands in light mode. Dark mode treats navy as the dark-canvas equivalent of white — a deliberate inversion.

---

## 3. Typography

**Font:** Inter (Google Fonts) — exclusively. Single typeface, hierarchy through weight only. Fallback stack: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.

> _Note (deviation from earlier plan):_ This replaces the PRD's Montserrat. Inter wins for two reasons: (a) better x-height and tabular numerals make data tables and OSHA 300 Log columns far more legible at small sizes, (b) Inter is already loaded in the scaffold. Result: less work, better fit for EHS's data-heavy screens.

### Scale

| Role | Size | Weight | Line height | Use |
|---|---|---|---|---|
| Display / H1 | 56px | 700 | 57.12px | Hero titles, dashboard welcome |
| H2 | 32px | 600 | 40px | Page titles _(deviation — see §11)_ |
| H3 | 24px | 700 | 36px | Card titles, section headers |
| H4 | 20px | 600 | 28px | Sub-section, modal titles _(added — needed for incident detail panels)_ |
| Body | 16px | 400 | 26px | Default paragraph and descriptive content |
| Body-sm | 14px | 400 | 20px | Compact body in dense layouts |
| Button / Label | 14px | 500 | 20px | Buttons, form labels, CTAs |
| Link | 14px | 700 | 21px | Inline links, emphasized small text |
| Caption | 12px | 400 | 18px | Timestamps, badges, meta |
| Tabular | 14px | 500 | 20px | OSHA log numbers, IDs (use `font-feature-settings: 'tnum' 1`) |

### Principles
- **Hierarchy through weight, not font.** Inter at 400 / 500 / 600 / 700 only.
- **Line-height generous.** Body 1.5×–1.65×. Compliance documents read across long sessions.
- **14px is the floor for interactive text.** 12px only for metadata.
- **Tabular numerals on data.** OSHA 300 Log, TRIR/DART, CAPA dates, incident IDs — always `tnum` on.
- **Body in `#191919` on `#FFFFFF`** = 21:1 contrast (WCAG AAA). Don't soften without reason.

---

## 4. Spacing & layout

**Base unit:** 4px. **Baseline grid:** 8px vertical rhythm.

### Scale
`4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 56 · 80`

| Use | Spacing |
|---|---|
| Inside compact components (badges, button groups) | 4–8px |
| Form input padding | 8px × 12px |
| Icon-to-text gap | 8–12px |
| Card internal padding (default) | 24px |
| Card internal padding (dense table cards) | 16px |
| Section gap (related content) | 24–32px |
| Section gap (chapter-level break) | 40–56px |
| Page hero margin | 80px |

### Container
- **Max width:** 1440px
- **Content max width:** 1200px (long-form, KPI dashboards)
- **Gutters:** desktop 32px / tablet 24px / mobile 16px
- **Grid:** 12-column desktop → 6-column tablet → 1-column mobile

### Border radius (8-step scale)

| Token | px | Use |
|---|---|---|
| `--radius-none` | 0 | Data tables (sharp top edge), full-bleed sections |
| `--radius-sm` | 4 | Tight chips, internal pills |
| `--radius-md` | 6 | Inputs (matches SmartQHSE inputs), small badges |
| `--radius-lg` | 8 | **Default for cards** (`--radius` base) |
| `--radius-xl` | 12 | Buttons, status badges, interactive elements |
| `--radius-2xl` | 16 | Modals, popovers |
| `--radius-full` | 9999 | Avatar, severity pill badges |

We diverge from SmartQHSE's "12px on cards, 0px flush" by **using 8px as the card default**. Reason: shadcn ships with `--radius: 0.5rem` (8px) and our seeded incident lists, CAPA tables, and Kanban cards will be uniform. 0px flush is fine for the OSHA 300 Log table specifically.

---

## 5. Depth & elevation

| Level | Treatment | Use |
|---|---|---|
| 0 — Flat | `box-shadow: none` | Default cards, button rest, page surfaces |
| 1 — Raised | `0 1px 0 0 rgba(10, 37, 64, 0.04)` | Card hover, navbar, grouped content |
| 2 — Elevated | `0 2px 4px 0 rgba(10, 37, 64, 0.06)` | Dropdown, tooltip, toast |
| 3 — High | `0 4px 12px 0 rgba(10, 37, 64, 0.10)` | Modal, popover, drag preview |
| 4 — Critical | `0 8px 24px 0 rgba(10, 37, 64, 0.14)` | OSHA/RIDDOR alert banner (NEW — to make regulatory countdowns float visually above the dashboard) |

Shadows are **navy-tinted, not black** — aligns the depth language with the navy palette and avoids "muddy gray" shadows that fight the brand purple.

---

## 6. Component recipes

These are the canonical specs. shadcn defaults must be overridden to match.

### 6.1 Buttons

#### Primary
- bg `#735CDD` · text `#FFFFFF` · padding `12px 24px` · 14/500 · radius `12px` · height `44px`
- Hover bg `#5E47C8` · Active bg `#4A36AE` · Disabled bg `#E5E7EB` text `#CBD5E1`

#### Secondary (outlined)
- bg `transparent` · text `#37352F` · padding `8px 12px` · 14/500 · radius `12px` · height `36px` · border `1px solid #E5E7EB`
- Hover bg `#F8FAFC` border `#CBD5E1` · Active bg `#E2E8F0` border `#735CDD`

#### Ghost (tertiary)
- bg `transparent` · text `#735CDD` · padding `8px 12px` · 14/500 · radius `12px` · height `36px`
- Hover bg `rgba(115, 92, 221, 0.08)` text `#5E47C8`
- Active bg `rgba(115, 92, 221, 0.16)` text `#4A36AE`

#### Destructive (NEW — added for our context)
- bg `#DC2626` · text `#FFFFFF` · padding `12px 24px` · 14/500 · radius `12px` · height `44px`
- Use for: severity override (downgrade), delete attachment, close incident as duplicate
- Never use for "Submit" — submitting an incident report is a primary action

### 6.2 Inputs

- bg `#FFFFFF` · text `#191919` · placeholder `#6B6B6B` · padding `8px 12px` · 14/400 · radius `6px` · height `36px (desktop) / 44px (mobile)` · border `1px solid #E5E7EB`
- Focus border `#735CDD` outline none box-shadow `0 0 0 3px rgba(115, 92, 221, 0.10)`
- Error border `#DC2626` bg `rgba(220, 38, 38, 0.05)`
- Disabled bg `#F8FAFC` border `#CBD5E1` text `#CBD5E1`

### 6.3 Cards

#### Default
- bg `#FFFFFF` · border `1px solid #E5E7EB` · radius `8px` · padding `24px` · shadow none

#### Elevated (interactive)
- adds `box-shadow: 0 1px 0 0 rgba(10, 37, 64, 0.04)` at rest
- hover `box-shadow: 0 2px 4px 0 rgba(10, 37, 64, 0.08)` and `border-color: #CBD5E1`

#### Severity card (NEW — for incident list rows)
- adds left-border accent `4px solid {severity color}` to encode S1–S5 visually
- example for S1: `border-left: 4px solid #B91C1C`

### 6.4 Badges

All pill-shaped (radius `9999px`) at 12/500 with `padding: 4px 10px`. Tinted bg + matching text:

| Variant | Background | Text | Used for |
|---|---|---|---|
| Default | `#E2E8F0` | `#0A2540` | Generic |
| Brand | `rgba(115,92,221,0.10)` | `#5E47C8` | Brand-tinted ("Auto-classified", "AI-suggested") |
| Success | `rgba(22,163,74,0.10)` | `#15803D` | Verified, Closed |
| Warning | `rgba(245,158,11,0.10)` | `#92400E` | Pending verification |
| Error | `rgba(220,38,38,0.10)` | `#DC2626` | Overdue, OSHA recordable |
| Severity S1 | `rgba(185,28,28,0.10)` | `#B91C1C` | Critical |
| Severity S2 | `rgba(234,88,12,0.10)` | `#9A3412` | Major |
| Severity S3 | `rgba(245,158,11,0.10)` | `#92400E` | Moderate |
| Severity S4 | `rgba(22,163,74,0.10)` | `#15803D` | Minor |
| Severity S5 | `rgba(107,114,128,0.10)` | `#374151` | Insignificant |
| Track A | `rgba(185,28,28,0.10)` | `#B91C1C` | Full investigation |
| Track B | `rgba(245,158,11,0.10)` | `#92400E` | Light investigation |
| Track C | `rgba(22,163,74,0.10)` | `#15803D` | Log & close |

### 6.5 Navigation

#### Top bar
- bg `rgba(255, 255, 255, 0.95)` · backdrop-filter `blur(10px)` · height `56px` · padding `16px 32px`
- shadow `0 1px 2px 0 rgba(0,0,0,0.05)` · text `#191919`

#### Sidebar (collapsed default — 80px, expanded 240px)
- bg `#FFFFFF` · right border `1px solid #E5E7EB` · shadow `0 0 0 0 rgba(0,0,0,0)` (flat)
- Item: 14/500 · padding `12px 16px` · radius `8px` · gap to icon 12px
- Hover: bg `rgba(115, 92, 221, 0.08)` text `#5E47C8`
- Active: bg `rgba(115, 92, 221, 0.10)` text `#735CDD` left-border `3px solid #735CDD` (or pill if collapsed)

### 6.6 Regulatory alert banner (NEW — EHS-specific)

This is the single most important component in our app — countdown for OSHA 8hr / RIDDOR immediate.

- Layout: full-width, sticky below topbar
- Border-left: `4px solid #DC2626`
- Background: `rgba(220, 38, 38, 0.06)`
- Padding: `16px 24px`
- Title: 14/600 `#DC2626`
- Body: 14/400 `#191919`
- Countdown chip: pill, bg `#DC2626`, text `#FFFFFF`, 12/600
- Action link (right): "Mark notified" — ghost button styling
- Shadow: level 4 (Critical) — floats visually

For warning-tier (24hr OSHA, 15-day RIDDOR): swap red → amber `#F59E0B`.

### 6.7 5×5 Risk matrix (NEW — EHS-specific)

- Cell size: 64×64px desktop, 48×48px mobile
- Cell border: `1px solid #E5E7EB`
- Cell text: 12/500
- Cells inherit severity color tint at 16% for the calculated cell
- Selected cell: 2px solid `#735CDD` outline, severity tint at 28%
- Row labels (likelihood) and column labels (consequence): 12/500 `#475569`

### 6.8 Body map (NEW — EHS-specific)

- SVG human silhouette, neutral gray fill `#E2E8F0`
- Hover region: fill `rgba(115, 92, 221, 0.20)` cursor pointer
- Selected region: fill `#735CDD` stroke `#5E47C8 1px`
- Multi-select supported (worker may flag multiple body parts)

### 6.9 5-Why chain (NEW — EHS-specific)

- Each row: numbered circle (1–5) bg `#735CDD` text white 14/700, then question/answer pair
- Connector line between rows: 1px dashed `#CBD5E1`
- Last row (root cause): numbered circle bg `#0A2540`, label "Root cause" badge

---

## 7. Tailwind v4 token mapping

Maps the palette into `app/globals.css` `@theme inline` so utilities like `bg-primary`, `text-foreground`, `border-border` work natively.

```css
@theme inline {
  /* Brand */
  --color-primary: var(--brand);
  --color-primary-foreground: var(--background);

  /* Surface */
  --color-background: var(--background-cool);
  --color-foreground: var(--foreground);
  --color-card: var(--background);
  --color-card-foreground: var(--foreground);
  --color-popover: var(--background);
  --color-popover-foreground: var(--foreground);

  /* Neutrals */
  --color-muted: var(--background-warm);
  --color-muted-foreground: var(--foreground-muted);
  --color-accent: var(--surface-hover);
  --color-accent-foreground: var(--foreground);
  --color-border: var(--border);
  --color-input: var(--border);
  --color-ring: var(--brand);

  /* Status */
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--background);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--background);
  --color-info: var(--accent);
  --color-info-foreground: var(--navy);

  /* Severity (NEW EHS-specific) */
  --color-sev-1: oklch(0.498 0.222 27.0);
  --color-sev-2: oklch(0.643 0.193 39.5);
  --color-sev-3: oklch(0.753 0.165 70.0);
  --color-sev-4: var(--success);
  --color-sev-5: oklch(0.481 0.013 264.0);

  /* Radii */
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.375rem;  /* 6px — inputs */
  --radius-lg: 0.5rem;    /* 8px — cards (DEFAULT --radius base) */
  --radius-xl: 0.75rem;   /* 12px — buttons, badges */
  --radius-2xl: 1rem;     /* 16px — modals */

  /* Typography */
  --font-sans: var(--font-inter);
}

:root {
  --brand: oklch(0.554 0.196 285.0);            /* #735CDD */
  --brand-hover: oklch(0.475 0.188 285.0);      /* #5E47C8 */
  --brand-pressed: oklch(0.402 0.180 285.0);    /* #4A36AE */
  --accent: oklch(0.823 0.139 224.0);           /* #00D4FF — reserved */
  --navy: oklch(0.215 0.044 252.5);             /* #0A2540 */

  --foreground: oklch(0.180 0 0);
  --foreground-muted: oklch(0.408 0.039 252.0);
  --foreground-subtle: oklch(0.475 0 0);
  --background: oklch(1.000 0 0);
  --background-cool: oklch(0.984 0.003 247.9);
  --background-warm: oklch(0.965 0.001 86.0);
  --surface-hover: oklch(0.913 0.014 248.9);
  --border: oklch(0.918 0.005 247.9);
  --border-strong: oklch(0.842 0.014 248.9);

  --destructive: oklch(0.577 0.245 27.4);       /* #DC2626 */
  --warning: oklch(0.753 0.165 70.0);           /* #F59E0B */
  --success: oklch(0.594 0.158 152.0);          /* #16A34A */
  --success-hover: oklch(0.516 0.150 152.0);    /* #15803D */

  --radius: 0.5rem;
}

.dark {
  --background: oklch(0.215 0.044 252.5);       /* navy as canvas */
  --background-cool: oklch(0.265 0.040 252.0);
  --background-warm: oklch(0.245 0.038 252.5);
  --foreground: oklch(0.965 0.001 86.0);
  --foreground-muted: oklch(0.745 0.020 247.9);
  --foreground-subtle: oklch(0.625 0.015 247.9);
  --brand: oklch(0.660 0.180 285.0);            /* lifted lightness for navy canvas */
  --brand-hover: oklch(0.554 0.196 285.0);
  --brand-pressed: oklch(0.475 0.188 285.0);
  --border: oklch(1 0 0 / 12%);
  --border-strong: oklch(1 0 0 / 18%);
  --surface-hover: oklch(1 0 0 / 8%);
  --destructive: oklch(0.683 0.225 27.0);
  --warning: oklch(0.795 0.155 70.0);
  --success: oklch(0.685 0.155 152.0);
  --success-hover: oklch(0.594 0.158 152.0);
}
```

---

## 8. Responsive behavior

| Breakpoint | Width | Grid | Padding | Notes |
|---|---|---|---|---|
| Mobile | 320–479 | 1 col | 16px | Hamburger nav; full-width cards |
| Tablet sm | 480–767 | 2 col | 16px | Collapsed nav rail |
| Tablet lg | 768–1024 | 3 col | 24px | Side-by-side panels |
| Desktop | 1025–1440 | 4 col | 32px | Full nav, dense tables |
| Ultra-wide | 1441+ | 6 col | 40px | Centered to 1200px max |

### Touch targets
- Minimum 44×44px on mobile/tablet
- 48×48px for safety-critical actions ("Submit incident", "Verify CAPA closure")
- Form inputs: 44px height on mobile, 36px on desktop
- Min 8px gap between targets, 12px preferred

### Collapse strategy
- Nav: full inline → secondary row at tablet → hamburger drawer at mobile
- Cards: 4 → 2 → 1 column
- Data tables: full → priority columns + horizontal scroll → key/value card stack
- Forms: label-above → label-above (tablet) → label-inline (compact mobile only)
- Buttons: inline → stacked → stacked full-width

---

## 9. shadcn primitive overrides

| shadcn component | Token to override | Our value |
|---|---|---|
| `Button` (default variant) | bg / fg | `--brand` / `--background` |
| `Button` (destructive) | bg / fg | `--destructive` / `--background` |
| `Button` (outline) | border / fg | `--border` / `#37352F` |
| `Button` radius | `--radius` | `0.75rem` (12px, NOT 8px default) |
| `Input` radius | inline | `0.375rem` (6px) |
| `Input` height | inline | `36px` desktop, `44px` mobile |
| `Card` radius | `--radius` | `0.5rem` (8px) |
| `Card` shadow | inline | `none` default; level-1 on hover only |
| `Badge` radius | inline | `9999px` (full pill) |
| `Sidebar` width | `--sidebar-width` | `240px` expanded, `80px` collapsed |
| `Toast` (sonner) | inline | level-2 elevation, 8px radius |
| `Dialog` | inline | level-3 elevation, 16px radius |

The `radius-vega` shadcn style we picked already supports CSS variable overrides cleanly — no need to fork primitives.

---

## 10. Do's and Don'ts

### ✅ Do
- Use brand purple `#735CDD` for **all** primary actions. It is the trust signal.
- Maintain WCAG AAA contrast for body text (`#191919` on white = 21:1).
- Use 12px radius for buttons/badges, 8px for cards, 6px for inputs.
- Use generous line-height (1.5×–1.65× for body).
- Group related inputs at 12px gaps; separate sections at 40px.
- Use the neutral scale strictly: primary `#191919`, secondary `#475569`, tertiary `#6B6B6B`. No arbitrary grays.
- Reserve `--destructive` for critical errors and dangerous actions only.
- Test all four states (rest, hover, active, focus, disabled) on every interactive element.
- Use tabular numerals for all numeric data (`font-feature-settings: 'tnum' 1`).

### ❌ Don't
- Don't use navy `#0A2540` as a background in light mode — it's a text color.
- Don't mix typefaces. Inter only. Hierarchy via weight.
- Don't put shadows on cards in list/table layouts — borders only.
- Don't use cyan `#00D4FF` for primary actions or body text.
- Don't exceed 32px padding on cards in dense layouts (incident list, CAPA tables).
- Don't reduce font size below 14px for interactive text.
- Don't apply rounded corners to rigid data containers (OSHA 300 Log table).
- Don't ignore error state styling — red border + light red bg + explicit message must appear together.
- Don't reuse severity colors for unrelated UI (don't tint a generic "saved" toast with S4 green if it isn't about an incident — use the `Success` badge variant instead).

---

## 11. Suggestions & deviations from the source spec

I adapted the SmartQHSE system rather than copying it verbatim. Here's what changed and why:

1. **Severity color system added.** The source spec doesn't define S1–S5 or Track A/B/C colors — these are EHS-specific and central to our product. Without them, every incident card looks the same. **Decision:** explicit severity palette in §2, badge variants in §6.4.

2. **Status colors added.** Same reasoning — incident status (`draft` → `closed`) is a frequent UI element. The source spec only had brand/error/warning.

3. **Dark mode added.** Source spec is light-only. shadcn ships dark mode for free; we'd be leaving it on the table not to support it. Demo will start in light mode but dark is wired.

4. **Card default radius changed from 0px to 8px.** SmartQHSE prefers flush-edge cards, but our incident list, Kanban cards, and dashboard tiles read better with subtle rounding. We keep 0px for the OSHA 300 Log table specifically (sharp edges support tabular density).

5. **H2 deviation.** Source spec has H2 at 18px/400 — lighter than body. That's unusual and reads as a UI bug. **Recommendation:** H2 = 32px/600 instead; gives proper hierarchy between H1 (56px hero) and H3 (24px card title).

6. **Added H4 (20px/600).** Needed for "Injured Person", "Witnesses", "Evidence" sub-headings inside incident detail panels.

7. **Font: Inter, not Montserrat.** Inter has better tabular numerals and reads better at small sizes — matters for OSHA 300 Log columns and CAPA dates. Inter is also already installed. (If you specifically want Montserrat for SDSM brand parity, swap the `--font-sans` binding — it's a one-line change.)

8. **Cyan reserved.** The source spec uses cyan `#00D4FF` for "AI / ARIA" indicators. We don't have AI in v1, so cyan currently maps to `--color-info` for non-critical informational chips (e.g., "Auto-classified"). If you want to reserve it for a future AI assistant, we can drop `info` to a softer blue and keep cyan dormant.

9. **Critical regulatory banner (level-4 elevation).** Added a fourth elevation step specifically for the OSHA 8hr / RIDDOR immediate countdown banner. It needs to float visually above the dashboard so a glance reads urgency without reading copy.

10. **Color-blind safety pass — flagged for follow-up.** S2 (orange) and S3 (amber) are perceptually close for deuteranomaly. Mitigation: severity icons (🔴 ⬆️ ⚠️ ◯ ◌) accompany the badge color. This needs a quick test with a CVD simulator before stakeholder demo.

11. **Component recipes for EHS-specific elements added.** 5×5 risk matrix, body map, 5-Why chain, regulatory banner — none of these are in shadcn or the source spec, so they're fully spec'd here in §6.5–6.9.

### Open questions (would like your call)

- ~~**Brand teal as success?**~~ Resolved 2026-05-04: brand changed to purple `#735CDD`, so a dedicated success green `#16A34A` is now the standard. S4 (Minor severity) and Track C ("Log & close") share the success palette.
- **OSHA 300 Log radius.** Default 0px (sharp edges) for tabular density, or 8px to match other tables? I'd vote 0px for the printable preview, 8px for the in-app card frame.
- **Sidebar default state.** Collapsed (80px, icon-only) or expanded (240px) by default on desktop? I'd vote expanded — workers/managers benefit from labels — but EHS pros may prefer screen real estate for data tables.
