# Verum Omnis — Canonical Design Token Specification

Extracted verbatim from the production site (`index.html`, `seal-document.html`, `verify.html`,
`constitution.html`, `documents-resources.html` at verumglobal.foundation).
This is the single source of truth for porting the look to Android Compose and desktop web.

**The theme is permanently dark navy. There is no light mode.** Every surface sits on deep navy;
gold is the brand/emphasis color; desaturated blue is the "chrome" color (labels, links, secondary
UI); serif display type over sans body over mono metadata.

---

## 1. Color Palette

### 1.1 Navy backgrounds (page + section surfaces)

| Token | Hex | Usage |
|---|---|---|
| `navy-0` | `#040D1B` | **Page background** (body on every page). Also text color on gold buttons. |
| `navy-1` | `#0A1628` | Alternate section background (index `.bg-1`), modal input background. |
| `navy-2` | `#0F1F3A` | Raised section background (index `.bg-2`), stat/platform/modal card background. |
| `navy-table-head` | `#0E2140` | Constitution in-document table header fill. |
| `navy-pre` | `#0A1830` | Constitution `<pre>` code-block fill. |

Section gradient (index "evidence" band): `linear-gradient(to bottom, #0F1F3A 0%, #0A1628 100%)`.
Hero fallback gradient: `linear-gradient(135deg, #0A1628 0%, #0F1F3A 50%, #040D1B 100%)`.

### 1.2 Panel / card fills (translucent navy-blue washes)

Cards are NOT opaque — they are translucent blue washes over `#040D1B`:

| Token | Value | Usage |
|---|---|---|
| `card` (index) | `rgba(26,46,82,0.4)` | index `.card`; hover → `rgba(26,46,82,0.6)` |
| `panel` | `rgba(15,52,96,0.12)` | Primary card on app pages (identity card, constitution card, QR seal card) |
| `panel-dim` | `rgba(15,52,96,0.08)` | Secondary panels: doc-list items, results box, upload zone, meta cards, info items |
| `panel-input` | `rgba(15,52,96,0.15)` | Text input background |
| `well` | `rgba(4,13,27,0.6)` | Sunken well: hash displays, QR-paste textarea, chain steps, inline code bg |
| `well-dim` | `rgba(4,13,27,0.4)` | Preview section bg, table header bg (index charges table `rgba(4,13,27,0.4)`) |
| `panel-quote` | `rgba(26,46,82,0.3)` | Quote panels, apps-note, v-feat cards, table row hover |

### 1.3 Borders

| Token | Value | Usage |
|---|---|---|
| `border` | `#1A2E52` | Solid border: index cards, inputs, upload-zone dash, constitution table cells, chips fill |
| `border-dim` | `#2A4A82` | Lighter structural accents, disabled/ghost text, placeholder tone (index) |
| `border-soft` | `rgba(26,46,82,0.5)` | **Most common**: nav bottom border, app-page card borders, step dividers, hash-display borders |
| `border-softer` | `rgba(26,46,82,0.4)` | meta-card / info-item borders |
| `border-row` | `rgba(26,46,82,0.3)` | `.id-field` row divider, footer top border (verify) |
| `border-dash` | `rgba(26,46,82,0.6)` | verify upload-zone dashed border |

### 1.4 Accents

| Token | Hex | Usage |
|---|---|---|
| `gold` | `#D4A843` | Brand gold: CTAs, active nav link, eyebrows/kickers, card `h3` headings, list markers, focus borders, hover borders |
| `gold-hover` | `#E8C567` | Gold button hover fill |
| `gold-deep` | `#b8942a` | Dark end of the gold CTA gradient: `linear-gradient(135deg, #D4A843 0%, #b8942a 100%)` |
| `gold-press` | `#c49a3a` | verify `.btn-primary:hover` (flat variant) |
| `blue` | `#4A7EC7` | Accent blue: nav links, field labels, secondary text, hints, outline buttons, icons |
| `blue-deep` | `#1a5f9e` | Dark end of blue gradient button: `linear-gradient(135deg, #1a5f9e, #4A7EC7)` |
| `blue-soft` | `#7EA8E0` | "Legacy / neutral" result headings and badges |
| `code-gold` | `#E4C97A` | Constitution inline `<code>` text |
| `quote-cream` | `#EDE6D4` | Constitution blockquote text |
| `pre-text` | `#C9D4E4` | Constitution `<pre>` text |

Gold washes: `rgba(212,168,67,0.06)` (honesty-note bg), `rgba(212,168,67,0.08)` (banners, active
mode card, gold pill bg), `rgba(212,168,67,0.1)` (active seal-type), `rgba(212,168,67,0.3)` /
`rgba(212,168,67,0.4)` (gold borders), glow shadows `rgba(212,168,67,0.3)`–`0.35`.
Blue washes: `rgba(74,126,199,0.1)` (legacy result bg), `rgba(74,126,199,0.15)` (badge bg / LE
banner gradient start), `rgba(74,126,199,0.35)` (borders), glow `rgba(74,126,199,0.2)`–`0.3`.

### 1.5 Text

| Token | Hex | Usage |
|---|---|---|
| `offwhite` | `#F8F9FA` | Headings, strong text, link hover, input text. NEVER pure white for text. |
| `body` | `#D5D8DD` | Default body text (body color on every page) |
| `muted` | `#94a3b8` | Muted descriptions (doc-card p, mode-card span, helper notes) |
| `muted-note` | `#8ea3b5` | OTS receipt note (seal page) |
| `blue` `#4A7EC7` | doubles as secondary/label text everywhere |

Selection: `::selection { background:#D4A843; color:#040D1B; }`

### 1.6 Status colors

| Token | Hex / value | Usage |
|---|---|---|
| `success` | `#22c55e` | Hash values, complete pipeline step, LE-banner title, "acknowledged" text, `.mono` inline hashes |
| `success-bright` | `#4ADE80` | VERIFIED result heading, match badge text, clean value |
| `success-green (index)` | `#2D9C5E` | index `--green` (patent dot, standards accents) |
| `success-wash` | `rgba(34,139,104,0.1–0.15)` bg, `rgba(34,139,104,0.3–0.4)` border | verified result box / match badge |
| `error` | `#ef4444` | Pipeline error step fill; index uses `#DC2626` (`--red`) |
| `error-bright` | `#F87171` | TAMPERED heading, error text, mismatch labels, hit values |
| `error-wash` | `rgba(180,60,60,0.1–0.15)` bg, `rgba(180,60,60,0.3–0.4)` border | tampered result box / badge, error box |
| `neutral-wash` | `rgba(74,126,199,0.10–0.15)` bg, `rgba(74,126,199,0.35–0.4)` border | legacy/neutral result & badges (text `#7EA8E0`) |

---

## 2. Typography

Three families, strict roles:

| Role | Stack | Where |
|---|---|---|
| **Display serif** | `'Cormorant Garamond', Georgia, serif` | ALL headings (h1–h4, card titles, stat numbers, quotes). Light weights: 300 for page h1 / big numerals, 400–500 for card & section headings. Italic for quotes. |
| **Mono** | `'JetBrains Mono', 'Courier New', monospace` (index/docs load JetBrains Mono; seal/verify/constitution use plain `'Courier New', monospace`) | ALL labels, kickers, nav links, buttons, hashes, values, table headers, footers — the "forensic metadata" voice. |
| **Body sans** | `'Segoe UI', system-ui, -apple-system, sans-serif` (index: `'Source Sans 3'` first) | Body copy, descriptions, inputs. |

### 2.1 The mono-label convention (load-bearing, use everywhere)

Every label/kicker/nav-link/footer is mono + UPPERCASE + wide letter-spacing + blue or gold:

| Variant | size | letter-spacing | transform | color |
|---|---|---|---|---|
| Nav link | 12px (index .7rem) | `0.1em` | uppercase | `#4A7EC7`; hover `#F8F9FA`; active `#D4A843` |
| Field label (`.id-label`) | 11px | `0.1em` | uppercase | `#4A7EC7` |
| Small form label | 11px | `0.05em`–`0.08em` | uppercase | `#4A7EC7` |
| Eyebrow / page header label | 12px (0.75rem) | `0.15em` | uppercase | `#D4A843` |
| Table header | 11px | `0.08em`–`0.1em` | uppercase | `#D4A843` |
| Footer bar | 11–12px | `0.08em` (index sealed line `0.1em`) | uppercase | `#4A7EC7` |
| Stat label | 11px (0.72rem) | `0.1em`–`0.12em` | uppercase | `#4A7EC7` |
| Pill/chip | 0.62–0.72rem | `0.1em`–`0.15em` | uppercase | gold or blue |
| Button text | 0.7–0.8rem / 13px | `0.08em`–`0.1em` | uppercase | per button |

### 2.2 Size scale

| Element | Spec |
|---|---|
| Page h1 (hero) | serif 300, `clamp(2.5rem, 8vw, 5rem)`, ls `-0.03em`, lh 1.05, `#F8F9FA` |
| Page h1 (app pages) | serif 300, `clamp(2rem, 6vw, 3.5rem)` (verify: max 3rem), ls `-0.03em`, lh 1.1 |
| Section title (index) | serif 300, `clamp(2rem, 5vw, 3.5rem)`, ls `-0.03em`, lh 1.12 |
| Constitution section h2 | serif 400, `1.9rem`, gold `#D4A843`, ls `-0.01em` |
| Card h3 | serif 500, `1.3rem`, gold (verify/constitution); serif 400 20–24px gold (seal/docs) |
| Sub-heading h3 | serif 400–500, `1.35rem`, `#F8F9FA` |
| Body | 1rem–1.02rem, lh 1.6–1.75, `#D5D8DD` |
| Lead | 1.125rem, lh 1.7 |
| Small/desc | 0.85–0.95rem, lh 1.5–1.65 |
| Mono value | 12–13px; long hashes 11px, lh 1.6, `#22c55e` |
| Stat numeral | serif 300, 1.875rem (inline) up to `clamp(2.5rem,6vw,4rem)` (stat cards), gold |
| Footnote | 0.75rem, `#2A4A82` |

Body defaults: `-webkit-font-smoothing: antialiased; line-height: 1.6;`

---

## 3. Component Anatomy

### 3.1 Top navigation bar (`.topnav` / `.nav`)

- Fixed, full-width, top; `z-index: 50`; **height 64px**.
- Background `rgba(4,13,27,0.85)` + `backdrop-filter: blur(12px)` (+ `-webkit-` prefix).
  (Index starts at `rgba(4,13,27,0.6)` and darkens to `0.85` after scroll.)
- `border-bottom: 1px solid rgba(26,46,82,0.5)`.
- Inner row: `max-width 1200px` (index 1400px), auto-centered, `height 100%`, flex,
  `align-items:center; justify-content:space-between`, `padding: 0 clamp(1.5rem, 5vw, 4rem)`.
- Logo: image `height 40px; width auto` (left).
- Link cluster (right): flex, `gap: 32px`. Links: mono 12px, uppercase, ls `0.1em`,
  color `#4A7EC7`, no underline, `transition: color 0.3s`; hover `#F8F9FA`; **active page
  link is gold `#D4A843`**.
- Optional CTA slot: outline button `1px solid #4A7EC7`, text `#4A7EC7`, `padding 10px 20px`,
  radius 6px; hover border+text `#D4A843`. Gold CTA variant: `#D4A843` fill, `#040D1B` text,
  600 weight; hover `#E8C567` + `box-shadow 0 0 20px rgba(212,168,67,0.3)`.
- Mobile (≤768px): link cluster hidden (index swaps to full-screen navy menu + hamburger).
- Page content clears the bar with ~80–100px top margin on the first block.

### 3.2 Card (`.card` / `.identity-card`)

- Background `rgba(15,52,96,0.12)`; border `1px solid rgba(26,46,82,0.5)`;
  **radius 16px; padding 24px; margin-bottom 24px**.
- Card heading `h3`: serif, `1.3rem`, weight 500, **gold `#D4A843`**, `margin-bottom 16px`.
- Secondary panel variant: bg `rgba(15,52,96,0.08)`, border `rgba(26,46,82,0.4–0.5)`, radius 12px,
  padding 16–24px.
- Index marketing card: bg `rgba(26,46,82,0.4)`, border `1px solid #1A2E52`, radius `0.5rem`,
  padding `2rem`; hover: border `#4A7EC7`, bg `rgba(26,46,82,0.6)`,
  shadow `0 4px 24px rgba(74,126,199,0.1)`.
- Hoverable list card (doc-list): border-color → `#D4A843` on hover, `transition 0.3s`.
- Gold-flag card (QR seal / custody anchor): same panel but border `rgba(212,168,67,0.35)`.

### 3.3 ID-field row (`.id-field` — the label/value pattern inside cards)

- Flex row: `justify-content: space-between; align-items: baseline; gap: 16px;
  padding: 8px 0; border-bottom: 1px solid rgba(26,46,82,0.3);` last row no border.
- Label (`.id-label`): mono 11px, uppercase, ls `0.1em`, `#4A7EC7`, `white-space: nowrap`.
- Value (`.id-value`): mono 13px, `#D5D8DD`, `text-align: right; word-break: break-all`.
- Hash value variant (`.id-value.hash`): **`#22c55e`**, 11px, lh 1.6.
- Links inside values: `#4A7EC7` → hover `#F8F9FA`.
- Mobile ≤600px: stack to column, `gap 4px`, value left-aligned.

### 3.4 Gold CTA button (`.pdf-cta` / `.seal-btn` / `.btn-primary` / index `.btn-gold`)

- Fill: `linear-gradient(135deg, #D4A843 0%, #b8942a 100%)` (app pages) or flat `#D4A843` (index).
- Text: **`#040D1B`** (navy-on-gold, never white), mono, 13px (index 0.8rem), weight 600
  (index 500), uppercase, ls `0.08em` (index `0.1em`).
- Padding `16px 40px` (large CTA), `18px` full-width (seal-btn), `14px 32px` (.btn),
  `.9rem 1.75rem` (index). Radius 10px (index `0.5rem`, small `0.45rem`); seal-btn 12px.
- Hover: `#E8C567` fill + glow `box-shadow: 0 0 20px rgba(212,168,67,0.3)`
  (index `0 0 24px rgba(212,168,67,0.35)`); seal-btn also `translateY(-2px)` and
  `0 8px 30px` glow. Disabled: `opacity 0.4; cursor not-allowed`.
- Outline sibling: transparent bg, `1px solid #4A7EC7`, text `#4A7EC7`; hover → gold border+text.
- Blue gradient sibling (rare): `linear-gradient(135deg,#1a5f9e,#4A7EC7)`, text `#F8F9FA`,
  shadow `0 4px 15px rgba(74,126,199,0.3)`.

### 3.5 Honesty-note callout (`.honesty-note`)

- `border-left: 3px solid #D4A843; background: rgba(212,168,67,0.06);
  border-radius: 0 12px 12px 0; padding: 16px 20px; margin-bottom: 40px;`
- Text: sans `0.92rem`, lh 1.65, `#D5D8DD`; `strong` → `#F8F9FA`.
- Constitution blockquote variant: same left border + wash, text `#EDE6D4`, padding 12px 18px.
- Index quote-block (big variant): bg `rgba(26,46,82,0.4)`, `border-left: 4px solid #D4A843`,
  radius `0 .5rem .5rem 0`, padding `2rem clamp(1.5rem,4vw,3rem)`; quote text serif italic
  `clamp(1.25rem,3vw,1.75rem)` `#F8F9FA`; attribution `#4A7EC7` 0.875rem.

### 3.6 Section heading with `.secno` kicker (constitution sections)

- `section` top margin 60px.
- `h2`: serif 400, `1.9rem`, **gold `#D4A843`**, ls `-0.01em`, `margin-bottom 6px`.
- `.secno` (kicker inside h2, displayed as its own line above): `display:block`,
  mono, `1.2rem`, **blue `#4A7EC7`**, ls `0.05em`, `margin-bottom 4px`.
- Immediately followed by `.gold-rule`: `height:1px; border:none;
  background: linear-gradient(90deg, #D4A843 0%, rgba(212,168,67,0.1) 100%); margin: 10px 0 24px;`
- Index equivalent: `.eyebrow` mono 0.75rem ls `.15em` uppercase gold above a serif-300 title.

### 3.7 Seal footer bar (`.site-footer` / page `.footer`)

- Sits at page bottom: `margin-top: 60px; padding-top: 30px` (or `padding: 40px 20px`),
  `border-top: 1px solid rgba(26,46,82,0.5)` (verify uses `0.3`).
- Centered text, mono, 11–12px, uppercase, ls `0.08em`, **`#4A7EC7`**, `line-height: 2`.
- Canonical copy pattern, two lines:
  `Verum Omnis Foundation — Patent Pending` /
  `Constitution v6.0 Final — Article X Non-Weaponization Doctrine`.
- Muted variant (verify/constitution): `#D5D8DD` at `opacity 0.5`, 0.8rem.

### 3.8 Table (`.ctable` / index `.charges`)

- `width 100%; border-collapse: collapse;` font-size 0.95rem; wrap wide tables in an
  `overflow-x:auto` container (index adds `border:1px solid #1A2E52; border-radius:.5rem` on wrap).
- `th`: mono 11px, uppercase, ls `0.08em`(–`0.1em`), **gold `#D4A843`**, left-aligned,
  `padding 10px 12px` (index `1rem 1.25rem`), bg `rgba(15,52,96,0.25)` (index `rgba(4,13,27,0.4)`,
  constitution in-doc `#0E2140`), border `1px solid rgba(26,46,82,0.5)` (or `#1A2E52`).
- `td`: `padding 10px 12px`, same border, `vertical-align: top`, lh 1.6, `#D5D8DD`.
- Zebra: even rows bg `rgba(15,52,96,0.07)` (constitution in-doc: `rgba(26,46,82,0.25)`).
- Row hover (index): bg `rgba(26,46,82,0.3)`.
- Key cell `.k`: `#F8F9FA`, weight 600, nowrap.

### 3.9 Other recurring pieces

- **Upload zone**: `2px dashed #1A2E52` (verify: `rgba(26,46,82,0.6)`), radius 16–20px,
  padding `60px 40px` / `48px 24px`, centered, bg `rgba(15,52,96,0.08)`, cursor pointer;
  hover/dragover: border `#D4A843`, bg lightens (`rgba(15,52,96,0.2)` / gold wash `0.05–0.08`).
- **Hash display well**: bg `rgba(4,13,27,0.6)`, radius 10px, padding 16px, mono 12px
  **`#22c55e`**, `word-break: break-all`, border `1px solid rgba(26,46,82,0.5)`.
- **Text input / textarea / select**: bg `rgba(15,52,96,0.15)`, `1px solid #1A2E52`, radius 10px,
  padding `12px 16px`–`14px 18px`, text `#F8F9FA` 14–15px, sans; focus: `outline none;
  border-color #D4A843` (index modal focuses blue); placeholder `#4A7EC7` at 0.6 opacity.
  Checkbox: `accent-color: #D4A843`, 16–18px.
- **Pill / badge**: radius 999px, mono `0.62rem`–11px, uppercase, ls `0.08–0.15em`, padding
  `~3px 14px` to `.5rem 1.15rem`; gold pill: text `#D4A843` + border `rgba(212,168,67,0.4)`;
  status badges use the status washes of §1.6.
- **Result box**: radius 20px, padding 40px, centered; verified/tampered/legacy washes (§1.6);
  h2 serif 2rem 400 in status bright color; icon 64px; timestamp mono 12px at 0.7 opacity.
- **LE banner**: `linear-gradient(135deg, rgba(74,126,199,0.15), rgba(212,168,67,0.1))`,
  `2px solid #4A7EC7`, radius 12px, padding `24px 32px`, centered,
  shadow `0 4px 24px rgba(74,126,199,0.15)`; title mono 16px 700 uppercase ls `.15em` `#22c55e`.
- **Pipeline step**: flex row, `padding 14px 0`, divider `1px solid rgba(26,46,82,0.5)`;
  24px circular status: pending `2px solid #1A2E52` text `#4A7EC7`; processing gold border +
  1.5s opacity pulse; complete fill `#22c55e` text navy; error fill `#ef4444` text white.
- **Spinner**: 48px ring, `3px solid rgba(212,168,67,0.2)`, `border-top-color #D4A843`,
  1s linear spin.
- **Page header block**: centered; logo `max-width min(300–360px, 60–70vw)` with
  `filter: drop-shadow(0 0 40px rgba(74,126,199,0.2))`; gold mono label (§2.1 eyebrow);
  serif-300 h1; sub-paragraph `#D5D8DD` 1–1.125rem, max-width 600px auto.

---

## 4. Spacing, Radius, Motion

### 4.1 Layout
- Container: `max-width 800px` (verify) / **900px** (seal, constitution, docs) / 1000–1200px
  (index); centered; `padding: 40px 20px` (index: `0 clamp(1.5rem,5vw,4rem)`).
- Nav 64px; first content block clears it with 80–100px top margin.
- Index section rhythm: `padding: 120px 0`. App pages: blocks separated by 24–40px;
  major dividers `margin-top: 60px` + border-top.

### 4.2 Radius scale (px)
`6` small buttons/code chips · `8` micro-cards · `10` inputs, buttons, hash wells, mode toggles ·
`12` secondary panels, banners, doc cards · `16` primary cards, upload zones, results panels ·
`20` hero result boxes / verify upload zone · `999` pills/badges. Index uses rem versions:
`.375rem / .5rem / .75rem`. Never fully squared corners on interactive surfaces.

### 4.3 Spacing scale (px)
4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 60 (+ index rems 0.5–4rem). Card padding 24px;
card gap/margin-bottom 24px (secondary 12–16px); grid gaps 12–16px (index 1.5rem).

### 4.4 Motion
- Standard transition: `all|color 0.3s` (`0.3s ease`); quick hovers `0.2–0.25s`.
- Hover behaviors: border-color shifts (→ blue or gold), gold glow shadows, slight lifts
  (`translateY(-2px)` buttons, `-4px` stat cards).
- Pulses: status pulse 1.5s opacity; green dot ping 2.5s; spinner 1s linear; blink caret 1s.
- Reveal-on-scroll (index): fade + `translateY(20px)` over 0.7s ease with staggered delays.
- Respect `prefers-reduced-motion: reduce` — kill all of it.

---

## 5. Canonical hex quick-reference

```
#040D1B  page navy (bg, text-on-gold)     #D4A843  gold
#0A1628  navy-1                           #E8C567  gold hover
#0F1F3A  navy-2                           #b8942a  gold gradient deep
#1A2E52  border navy                      #4A7EC7  accent blue
#2A4A82  border dim                       #7EA8E0  soft blue (legacy)
#F8F9FA  off-white headings               #22c55e  success green (hashes)
#D5D8DD  body text                        #4ADE80  success bright
#94a3b8  muted text                       #2D9C5E  index green
                                          #ef4444 / #DC2626  error red
                                          #F87171  error bright
```
