# DESIGN LOCK -- Verum Omnis Web Properties

## WARNING: THIS IS THE PERMANENT VISUAL STANDARD

**Effective Date**: 2026-07-16
*(Date as stated by the Foundation; the file entered this repository's history on 2026-08-21 in fde9fb2.)*
**Status**: LOCKED -- No visual regressions permitted
**Applies to**: every page at the repository root (served by the webdocsol Worker at verumglobal.foundation), the legacy Pages origin verumglobal.pages.dev (the last tier of the Worker's serving chain), and all webdocsol-derived properties

---

## INTENT

This document exists to prevent visual degradation of the Verum Omnis
web properties. The current design (as of the locked date) represents
the canonical visual reference. Future changes may **enhance** or **refine**
the design, but they must **never** regress from the established standard.

This is not a flexible guideline. This is a hard lock.

---

## CANONICAL VISUAL REFERENCE

The repository-root `seal-document.html` (the page the Worker serves at
`verumglobal.foundation/seal-document.html`) is the visual reference. Its
inline `<style>` block in the page head is the checkable standard. The full
token set is in `VERUM_UI_TOKENS.md` and `verum-ui.css`. No reference
screenshot is held in this repository: `design-reference/screenshot-v1.2.5.png`
was named here but has never been in the history (checked 2026-10-03).

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
Secondary/Label Text:  #4A7EC7  (steel blue)
Muted Text:            #94a3b8  (descriptions, helper notes)
Muted Note:            #8ea3b5  (receipt and helper notes)
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
Body:            'Segoe UI', system-ui, -apple-system, sans-serif; lead 1.125rem / 1.7; section copy 16px / 1.7; panel copy 13-14px
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
| Seal Button | Gold gradient | `translateY(-2px)` + shadow | No separate rule | `opacity: 0.4` |
| Upload Zone | Dashed `#1A2E52` border | Dashed gold border + `rgba(15,52,96,0.2)` | Drag-over: gold border + gold wash `rgba(212,168,67,0.08)` | N/A |
| Seal Type Btn | Transparent, `#1A2E52` border, blue text | Blue border, off-white text | Gold border + gold text + gold tint | N/A |
| Text Input | Blue border + dark bg | Gold border on focus | Gold border | N/A |
| Toggle Link | Blue mono uppercase text | No hover rule today | N/A | N/A |

---

## RESPONSIVE BREAKPOINTS (LOCKED)

- **Desktop**: above 768px -- full layout; the content container caps at 900px
- **Tablet**: 768px -- hide nav links and nav CTA buttons
- **Narrow**: 640px -- the two sealing-mode cards (Seal document / Seal document with forensic report) stack to one column
- **Mobile**: 600px -- info and download grids go to one column; header h1 drops to 2.2rem

```css
@media (max-width: 768px) { .topnav-links, .topnav-cta { display: none; } }
@media (max-width: 600px) {
  .info-section .grid, .download-grid { grid-template-columns: 1fr; }
  .header h1 { font-size: 2.2rem; }
}
@media (max-width: 640px) { .mode-grid { grid-template-columns: 1fr; } }
```

---

## WHAT CONSTITUTES A REGRESSION

A regression is ANY change that:

1. **Reduces contrast** -- text becomes harder to read
2. **Changes the color palette** -- any color code differs from the locked palette (the full palette, including status brights and washes, is VERUM_UI_TOKENS.md §1 / verum-ui.css `:root`)
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

1. **Side-by-side comparison** with the current live page, or with the root `seal-document.html` stylesheet as it stands on `main`
2. **Color code audit** -- every color must match the locked palette
3. **Mobile check** -- test at 375px, 768px, and 1200px widths
4. **Interaction check** -- all hover/focus states must function
5. **Approval required** -- explicit sign-off that no regression has occurred

---

## REFERENCE MATERIALS

- **Screenshot**: none in the repository (see above)
- **Primary files**: `seal-document.html`, `verify.html`
- **Full token specification**: `VERUM_UI_TOKENS.md` (every page) and its portable stylesheet `verum-ui.css` (`--vo-*` tokens, `.vo-*` components). The pages do not link `verum-ui.css`: each carries its own inline `<style>` with the same values, so a change to a token must be made in the page and in both of these files.
- **Snapshots (not the live site)**: `seal-module/web/seal-document.html` and `seal-module/web/verify.html` are older snapshots kept with the portable sealing spec. They are not served (`.assetsignore`, `SITE_DENY_RE` in `worker/static-proxy.js`). Edit the root files; a change made only in `seal-module/web/` ships nothing.
- **Version label**: v1.2.5 is the name given to the locked design state on 2026-07-16. It is not a version string the pages carry (the sealing service is `Document Sealing Service v1.2.9` in `seal-document.html`; the verify footer states VO-DSS v1.2.7, `verify.html`).

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
