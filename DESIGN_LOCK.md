# DESIGN LOCK -- Verum Omnis Web Properties

## WARNING: THIS IS THE PERMANENT VISUAL STANDARD

**Effective Date**: 2026-07-16
**Status**: LOCKED -- No visual regressions permitted
**Applies to**: verumglobal.foundation, verumglobal.pages.dev, and all webdocsol-derived properties

---

## INTENT

This document exists to prevent visual degradation of the Verum Omnis
web properties. The current design (as of the locked date) represents
the canonical visual reference. Future changes may **enhance** or **refine**
the design, but they must **never** regress from the established standard.

This is not a flexible guideline. This is a hard lock.

---

## CANONICAL VISUAL REFERENCE

The current live deployment at `verumglobal.foundation/seal-document.html`
is the single source of truth for the visual standard. A screenshot is
included in this repository as `design-reference/screenshot-v1.2.5.png`.

### What "No Regression" Means

| Aspect | Current Standard | Regression = Unacceptable |
|--------|-----------------|---------------------------|
| **Background** | Deep navy `#040D1B` | Any lighter, brighter, or different hue |
| **Typography** | Cormorant Garamond headings, system UI body | Different heading font, reduced readability |
| **Gold accent** | `#D4A843` -- muted, sophisticated | Brighter gold, orange, yellow, or different color |
| **Blue accent** | `#4A7EC7` -- steel blue | Different blue tone, purple, or teal |
| **Text color** | `#D5D8DD` body, `#F8F9FA` headings | Reduced contrast, washed out text |
| **Card styling** | `rgba(15, 52, 96, 0.08)` with `rgba(26, 46, 82, 0.5)` border | Flat colors, harsh borders, no depth |
| **Nav bar** | Fixed, `rgba(4, 13, 27, 0.85)` with backdrop blur | Missing blur, different height, poor positioning |
| **Spacing** | Generous whitespace, 900px max-width container | Cramped layout, edge-to-edge content |
| **Buttons** | Gold gradient `#D4A843` to `#b8942a`, 12px radius | Different colors, harsh corners, flat without depth |
| **Upload zone** | Dashed `#1A2E52` border, hover glow to `#D4A843` | Solid border, no hover feedback, different shape |
| **Hash displays** | Monospace, `#22c55e` green on dark bg | Different font, reduced legibility |
| **Fraud warnings** | Red `#ef4444` with semi-transparent overlay | Different red, missing visual impact |
| **Status badges** | Circular with color-coded states | Square, flat, or missing states |
| **Footer** | Monospace, uppercase, tracked | Different font, missing structure |
| **Mobile** | Graceful degradation, hidden nav links, stacked grids | Broken layout, horizontal scroll, clipped content |

---

## COLOR PALETTE (LOCKED)

```
Primary Background:    #040D1B  (deep navy -- DO NOT CHANGE)
Card Background:       rgba(15, 52, 96, 0.08)
Card Border:           rgba(26, 46, 82, 0.5)
Nav Background:        rgba(4, 13, 27, 0.85)

Heading Text:          #F8F9FA  (near-white)
Body Text:             #D5D8DD  (light grey)
Muted Text:            #4A7EC7  (steel blue)
Hash/Green Text:       #22c55e  (verification green)

Gold Accent:           #D4A843  (primary CTA, active states)
Gold Hover:            #E8C567  (hover state)
Gold Dark:             #b8942a  (gradient end)

Blue Accent:           #4A7EC7  (links, secondary)
Blue Border:           #1A2E52  (borders, dividers)

Error/Red:             #ef4444  (fraud, tamper, errors)
Success/Green:         #22c55e  (verified, complete)
Pending/Yellow:        #D4A843  (processing, warning)
```

---

## TYPOGRAPHY (LOCKED)

```
Display / H1:    Cormorant Garamond, 300 weight, -0.03em tracking
H2 / Section:    Cormorant Garamond, 400 weight
H3 / Card:       Cormorant Garamond, 400 weight, 20-28px
Body:            Segoe UI, system-ui, 1.125rem, 1.7 line-height
Labels:          Courier New, monospace, 11-12px, uppercase, 0.08em tracking
Hash/Monospace:  Courier New, monospace, 12px
Nav Links:       Courier New, monospace, 12px, uppercase, 0.1em tracking
Buttons:         Segoe UI, system-ui, 15-16px, uppercase, 0.05em tracking
```

---

## LAYOUT (LOCKED)

```
Max Container Width:   900px (seal/verify pages), 1200px (nav inner)
Container Padding:     40px 20px
Section Spacing:       60px top margin between major sections
Border Radius Cards:   16px
Border Radius Buttons: 12px
Border Radius Inputs:  10px
Nav Height:            64px
```

---

## INTERACTION STATES (LOCKED)

| Element | Default | Hover | Active/Focus | Disabled |
|---------|---------|-------|--------------|----------|
| Seal Button | Gold gradient | `translateY(-2px)` + shadow | Slightly darker | `opacity: 0.4` |
| Upload Zone | Dashed blue border | Dashed gold border + bg tint | Same as hover | N/A |
| Seal Type Btn | Transparent + blue | Blue text + border | Gold border + bg tint | N/A |
| Text Input | Blue border + dark bg | Gold border on focus | Gold border | N/A |
| Toggle Link | Blue text | White text | N/A | N/A |

---

## RESPONSIVE BREAKPOINTS (LOCKED)

- **Desktop**: > 900px -- Full layout
- **Tablet**: 768px -- Hide nav links, hide CTA buttons in nav
- **Mobile**: 600px -- Single column grids, reduced font sizes, stacked elements

```css
@media (max-width: 768px) { .topnav-links, .topnav-cta { display: none; } }
@media (max-width: 600px) {
  .info-section .grid, .download-grid { grid-template-columns: 1fr; }
  .header h1 { font-size: 2.2rem; }
  .tick-container { flex-direction: column; }
}
```

---

## WHAT CONSTITUTES A REGRESSION

A regression is ANY change that:

1. **Reduces contrast** -- text becomes harder to read
2. **Changes the color palette** -- any color code differs from the locked palette
3. **Breaks the layout** -- elements overlap, clip, or misalign
4. **Removes whitespace** -- content feels cramped or rushed
5. **Changes typography** -- different fonts, sizes, or weights that alter the feel
6. **Removes hover/focus states** -- interactive elements feel dead
7. **Alters the nav bar** -- different height, positioning, or blur treatment
8. **Flattens the design** -- removes subtle depth (transparency, shadows, gradients)
9. **Degrades mobile experience** -- horizontal scroll, clipped content, broken grids
10. **Changes the upload zone feel** -- loses the dashed-border + glow interaction

---

## WHAT IS ACCEPTABLE

The following types of changes ARE permitted:

1. **Adding new sections** -- new feature panels, new info cards (must follow existing card styling)
2. **New pages** -- additional HTML pages (must import the same CSS variables/patterns)
3. **Animation refinements** -- smoother transitions, loading states (must not slow down core experience)
4. **Accessibility improvements** -- ARIA labels, focus rings, screen reader support
5. **Performance optimizations** -- CSS purging, asset optimization (must not remove styles)
6. **New interactive elements** -- additional toggles, dropdowns (must follow existing button/input styling)
7. **Content updates** -- text changes, new copy (must follow existing typography)

---

## ENFORCEMENT

Before any PR is merged that touches CSS, HTML structure, or visual elements:

1. **Side-by-side comparison** with the canonical screenshot
2. **Color code audit** -- every color must match the locked palette
3. **Mobile check** -- test at 375px, 768px, and 1200px widths
4. **Interaction check** -- all hover/focus states must function
5. **Approval required** -- explicit sign-off that no regression has occurred

---

## REFERENCE MATERIALS

- **Screenshot**: `design-reference/screenshot-v1.2.5.png` (current live look)
- **Primary files**: `seal-document.html`, `verify.html`
- **Module copies**: `seal-module/web/seal-document.html`, `seal-module/web/verify.html`
- **Version**: v1.2.5 (locked design state)

---

## SIGNATURE

This design lock was established by the Verum Omnis Foundation on
2026-07-16. It remains in effect until explicitly revoked by the
Foundation.

**DO NOT REGRESS FROM THIS DESIGN.**

The current look is the look. Maintain it. Improve upon it if you can.
But never -- under any circumstances -- make it worse.

---

*Verum Omnis Foundation -- Patent Pending*
*Constitution v6.0 Final -- Article X Non-Weaponization Doctrine*
