---
name: Thinking Spree · Cash
description: A monthly cash dashboard read the way a T-Sprint team decides; a plain verdict first, exact figures beside every chart, sticker dots as the only state language.
colors:
  shell: "#173A2D"
  shell-2: "#21503E"
  shell-ink: "#EEF3EF"
  shell-mute: "#B5CCBF"
  shell-line: "#2C5A47"
  wall: "#F4F6F3"
  paper: "#FFFFFF"
  ink: "#17221D"
  ink-2: "#33403A"
  mute: "#56635C"
  line: "#D8DED8"
  line-2: "#E8ECE7"
  in: "#2E7D4F"
  good: "#2E7D4F"
  out: "#3B5BA9"
  fc: "#D9731F"
  fc-ink: "#A8530F"
  fc-wash: "rgba(217, 115, 31, .07)"
  crit: "#C23B32"
  warn: "#B98500"
  note: "#6A7790"
  ser-in: "#173A2D"
  ser-out: "#8E9A93"
  seq-1: "#84958B"
  seq-2: "#5E7A6C"
  seq-3: "#3A5A4B"
  seq-4: "#173A2D"
  grid: "#E3E8E3"
  axis: "#9AA59F"
  focus: "#D9731F"
  gate-wall: "#D9D6CB"
  gate-note: "#F7E27B"
  gate-note-ink: "#2B2610"
  gate-error: "#8E1F17"
typography:
  verdict:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.28
  verdict-what-if:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 1.35
  gate-heading:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: "23px"
    fontWeight: 500
    lineHeight: 1.25
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    fontFeature: "tnum"
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
  chart-text:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  hair: "4px"
  sm: "7px"
  md: "8px"
  tab: "9px"
  card: "10px"
  bubble: "14px"
  sheet: "16px"
  pill: "99px"
  dot: "50%"
spacing:
  gutter: "clamp(16px, 3.2vw, 40px)"
  hair: "4px"
  tight: "8px"
  row: "10px"
  panel-gap: "12px"
  block: "18px"
  stage: "22px"
  column: "30px"
components:
  button-primary:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "7px 13px"
    height: "36px"
  button-primary-pressed:
    backgroundColor: "{colors.fc}"
    textColor: "{colors.paper}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "7px 13px"
    height: "36px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
    height: "34px"
  segmented-option-selected:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  books-badge:
    backgroundColor: "{colors.shell-2}"
    textColor: "{colors.shell-ink}"
    rounded: "{rounded.pill}"
    padding: "6px 13px 6px 9px"
  tab-current:
    backgroundColor: "{colors.wall}"
    textColor: "{colors.shell}"
    rounded: "{rounded.tab}"
    padding: "9px 16px 12px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "18px 20px"
  watch-note:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 14px 13px"
  input-text:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
    padding: "10px 12px"
    height: "44px"
  tooltip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 11px"
  work-panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    width: "440px"
    padding: "18px 22px 28px"
  gate-note:
    backgroundColor: "{colors.gate-note}"
    textColor: "{colors.gate-note-ink}"
    padding: "26px 26px 22px"
  gate-button:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "11px 14px"
    height: "44px"
---

# Design System: Thinking Spree · Cash

Source of truth: `assets/app.css` (tokens, light + dark), `assets/charts.js` (chart marks), `assets/app.js` (components), `assets/model.js` (number formats). Frontmatter carries light-mode values; dark values are in the Colors table.

## Overview

**Creative North Star: "The Decide Wall"**

Cash read the way a T-Sprint team decides. A flat forest-green shell holds the brand and the six stage tabs (Map, Sketch, Decide, Prototype, Test, Ask); below it sits a cool whiteboard-white wall where a plain serif verdict leads, a ruled figure strip follows, and charts carry an exact-figure margin. Coloured sticker dots are the single state language across every chart, list and label.

Accuracy beats atmosphere. Every figure is exact, traceable (Show working) and labelled actual or forecast. Decoration earns its place only by meaning something: the dots are data, the gate scene is the one piece of set dressing, and it sits outside the dashboard.

**Key Characteristics:**
- Flat green shell, whiteboard wall, white paper panels with hairline borders.
- Sticker dots: solid = actual, ring = forecast, colour = state, count = urgency.
- Orange is the forecast colour in data.
- Serif only for the verdict voice; grotesk for everything else, modest sizes.
- Every number is a button that opens its working.

## Colors

A quiet forest-and-whiteboard palette in which only the sticker colours carry state.

| Token | Light | Dark | Role |
|---|---|---|---|
| shell / shell-2 | #173A2D / #21503E | same | Header field; badge and tab hover |
| shell-ink / shell-mute | #EEF3EF / #B5CCBF | #E3ECE6 / #A9C2B4 | Text on the shell |
| wall | #F4F6F3 | #101814 | Page ground (cool, faint green; never cream) |
| paper | #FFFFFF | #16211B | Panels, notes, tooltips, Show working |
| ink / ink-2 / mute | #17221D / #33403A / #56635C | #E4ECE7 / #C3CEC8 / #9AA9A1 | Text tiers |
| line / line-2 | #D8DED8 / #E8ECE7 | #2A3830 / #1F2A24 | Borders / inner rules |
| in = good | #2E7D4F | #4FA676 | Actual line; dot above the safety line; safety line |
| warn | #B98500 | #D9AA30 | Dot below the safety line; 2-dot watch items |
| crit | #C23B32 | #E2675C | Below ₹0; 3-dot (most urgent) items; negative figures |
| note (slate) | #6A7790 | #93A0B8 | 1-dot "keep an eye" |
| fc / fc-ink / fc-wash | #D9731F / #A8530F / 7% wash | #D27A35 / #E7955A / 10% wash | Forecast ring, dashed line, forecast text, forecast zone |
| out | #3B5BA9 | #6F8FDB | Money-out direction (changes list dot, tooltip "Out" row) |
| ser-in / ser-out | #173A2D / #8E9A93 | #CFDAD3 / #6B7871 | Sketch series inks (client in / operating out) |
| seq-1..4 | #84958B → #173A2D | #6B7871 → #E3F2EA | Weekly dot grid, neutral-to-forest by closing cash |
| grid / axis | #E3E8E3 / #9AA59F | #213029 / #627069 | Gridlines / zero line, ticks, plan comparison line |

Dark mode follows `prefers-color-scheme` unless `data-theme` overrides it (moon button, stored in `ts.theme`). The shell stays the same green; the wall turns forest-black; dots keep their meaning. In dark mode primary buttons fill with `in` and take #0c1611 text.

### Named Rules

**The Sticker Rule.** Dots are the only state language. Solid = actual, ring = forecast. Colour = state: green above the safety line, amber below it, coral below zero or most urgent, slate = keep an eye. On the watch list, 1–3 dots = urgency (3 coral, 2 amber, 1 slate); a forecast item shows rings in its severity colour.

**The Orange-Is-Forecast Rule.** In data marks, orange means forecast and nothing else: ring dots, the dashed forecast line, outlined budget bars, the forecast wash, forecast text and rows. Outside the data, the build uses the same orange only as the interaction signal: focus ring, hover/highlight wash, current-tab dot, pressed Replay, slider accent, selected scenario border.

**The Non-Sticker Series Rule.** Series that are not states (Sketch in/out columns, horizontal bars, actual spend) use forest `ser-in` and grey `ser-out`, never sticker colours. Non-operating money is an outlined grey bar. Magnitude grids use the `seq-1..4` ramp.

## Typography

**Display Font:** Source Serif 4 (Georgia fallback), weight 500 roman + italic, verdict voice only
**Body Font:** Schibsted Grotesk (ui-sans-serif, system-ui fallback), weights 400/500/600/700

**Character:** A plain-spoken grotesk for every figure and label; the serif is reserved for sentences that state a verdict, with the italic second line carrying the consequence in its state colour.

### Hierarchy
- **Verdict** (Source Serif 4 500, 26px/1.28, 22px on phone, `text-wrap: balance`, max 30em): the Map verdict. Line one is roman in shell green (ink in dark mode); the `<em>` second line is italic, on its own line, coloured crit/warn/good by tone.
- **What-if verdict** (serif 500, 21px/1.35): figures inside it switch to grotesk 600.
- **Gate heading** (serif 500, 23px/1.25, italic second line).
- **Headline** (600, 22px/1.25, −0.01em): stage headings.
- **Figure** (600, 22px/1.2): figure strip values; 17px in the month card, chat facts and watch heading; 26px in Show working.
- **Title** (600, 15px/1.35): panel and chart headings; 14.5px for legends and tab names.
- **Body** (400, 15px/1.5; 14.5px on phone), lead text max 72ch.
- **Data** (13.5px): tables, bars, changes, split rows.
- **Label** (12.5px, mute): figure labels, keys, notes. Chart text 12px.

### Named Rules

**The Exact Figure Rule.** Figures are exact `en-IN` rupees with Indian grouping (₹1,92,490.53; paisa where shown, whole rupees where `dp=0`). The short lakh/crore form (₹1.92L, ₹1.24Cr) appears only on chart axes and direct labels. Negatives use a true minus (−) joined to ₹ by a word joiner (U+2060) so they never break across lines.

**The Columnar Numerals Rule.** Tabular figures apply only where numbers stack in columns: tables, Show working steps, tooltip rows, slider readouts. Figure strips, verdicts and labels keep proportional figures.

## Layout

- Container max 1440px, gutter `clamp(16px, 3.2vw, 40px)`. Shell: brand left, as-of line pushed right, Books balance badge, theme and lock icon buttons; tabs below as folder tabs into the wall.
- **Map grid:** `minmax(0,1fr) 380px` with a 30px gap; the 380px column is the watch list. The cash chart sits in `minmax(0,1fr) 196px` with the exact-figure margin at right.
- Stage gap 22px; panels pair in `.row-2` (1fr 1fr, 22px). What-if: 340px controls + chart. Scenarios: 4 columns, 2 at ≤1180px, 1 at ≤760px.
- **Breakpoints:** 1180px (watch list and What-if stack); 760px (phone: tab subtitles hide, tab strip scrolls edge to edge with a right fade mask, figure strip becomes 2 columns with cash full-width, margin goes 2-column below the chart, Show working becomes a bottom sheet); charts switch to phone geometry below 560px (520px for dots and budget).
- **No sideways scroll:** every grid track uses `minmax(0,1fr)` and grid children get `min-width: 0`.
- Print shows every stage and hides the shell, tools, tooltip and Show working.

## Elevation & Depth

Flat by default: hairline borders and tonal layering (wall → paper) carry structure. One soft step exists.

- **Note shadow** (`0 1px 2px rgba(23,34,29,.06), 0 4px 14px rgba(23,34,29,.05)`; dark `0 1px 2px rgba(0,0,0,.3)`): watch-list notes and the tooltip only.
- **Sheet shadow** (`-10px 0 30px rgba(0,0,0,.12)`): the Show working panel, which overlays content.
- The gate's sticky note has its own paper-on-wall shadow; it belongs to the scene, not the dashboard.

## Shapes

Gently rounded rectangles (10px panels and notes, 8px buttons and tooltips, 9px tabs and chat input, 7px select and segment options), 99px pills for chips and the Books badge, 14px chat bubbles with one 4px tail corner, 16px top corners on the phone sheet. Dots are perfect circles (11px; rings 2.4px stroke). Rules are 1px hairlines; table headers and totals take a 1.5px ink-2 rule. Chart bars have a 4px rounded data end and a square baseline.

## Components

### Buttons
- **Primary** (shell fill, white text, 8px, min 36px, 13.5px/600): Replay, Ask. Hover brightens 12%. Pressed (`aria-pressed`) turns orange. Dark mode fills with `in`.
- **Ghost:** transparent, ink text, line border; hover darkens the border. Table toggles, Back to the plan, Ask Claude (with an outbound arrow, pushed right).
- **Icon buttons:** 36px, 19px stroked SVG (1.8 stroke, round caps), 12% currentColor hover. Icons are inline SVG only.
- **Focus:** 2.5px orange outline, 2px offset, everywhere.

### Verdict and figure strip
Verdict sentence (see Typography), a sub-line ending in a "Show working" link, then the figure strip: values in a flex row between top and bottom hairlines, separated by inner rules, each value a Show working button with an Actual/Forecast tag and a mute label.

### Show working (every figure)
Every figure is a `.w` button: dotted underline at 35% currentColor, offset 4px, turning orange on hover. It opens the Show working panel: a 440px right-hand sheet (bottom sheet on phone) with an Actual/Forecast dot tag, title, 26px value, formula, ruled steps (label, source sheet/row, tabular value) and a note.

### Exact-figure margin
An ordered list beside the cash chart: dot (state colour, or orange ring for forecast) + month, exact value right-aligned. Forecast rows in fc-ink, negatives in crit, current month bold, hovered month on a 12% orange wash, highlighted rows with a 3px orange inset bar.

### Watch list (sticker-dot notes)
White notes on the wall (paper, 10px, note shadow), ranked by dots. Top row: 1–3 dots + exact amount; then the title (600, 14.5px), a mute note, and an Actual/Forecast tag. "New since last file" items get an orange-tinted border and a green "New" tag. The key above the list explains the dot counts and the ring.

### What-if controls
A paper panel of fieldsets (client pays late, cut a cost line, add a retainer) divided by hairlines; full-width selects (7px, 38px) and orange-accented range sliders with a tabular readout. On phone the output moves above the controls. The output chart shows actual (green), plan (grey dashed 5 5, no dots) and what-if (orange, ring dots).

### Scenario small multiples
Four paper cards, each with a name and line swatch, the end figure (20px/600), a mute note and a 150px line chart sharing one domain (3 ticks, no end labels). The selected card has an orange border.

### Ask (chat answers)
Questions are shell-green bubbles aligned right (14/14/4/14 radius). Answers are paper bubbles (14/14/14/4) with prose, a facts row (17px values with labels), and a meta line. Suggested questions are pill chips. Input is 44px high.

### Passcode gate
A full-screen flat 2D SVG studio (warm wall, sun wedge, whiteboard, desk, plant, forest notebook, lamp) with a yellow sticky note pinned at −1.2° holding the form. On success the lamp glow fades in (.9s), then the whiteboard fills with the T-Sprint stage row and a cash line (.9s, .4s delay), and the gate fades out (.6s). A wrong code shakes the note (.42s) and shows a dark-red error. Reduced motion collapses all of it to instant. The gate keeps casual visitors out; it is not security, and the UI must never claim otherwise.

### Chart marks (`assets/charts.js`)
- Plain SVG, one y-axis, hairline grid, zero line in `axis` (1.2px). Text is ink or mute, never the series colour.
- Lines 2px. Dots r 4.8 (solid, 2px paper ring) / 4.6 (paper fill, 2.4px coloured ring for forecast).
- Forecast: dashed orange line (6 5) inside an orange wash zone labelled "Plan (forecast)" or "Forecast". Plan comparison: grey dashed (5 5), no dots. Safety line: green dashed (5 5, 1.3px), labelled directly.
- Bars ≤24px wide with a 4px rounded data end. Budget is a 2.5px ink tick; forecast budget months are outlined orange bars.
- Direct labels only for the last actual and last forecast (600, ink, paper halo); end labels spread at least 17px apart.
- Every month is a hit target with `data-month`, so hover lights the same month in every chart, margin and table, with a tooltip of exact figures.
- Every chart has a Table toggle and an `aria-label`/`role="img"` summary.
- **Motion:** a 7px marker stroke at 32% opacity traces the already visible exact line once (1.15s, `cubic-bezier(.3,.7,.2,1)`), then fades; skipped under reduced motion. Replay steps month by month (520ms per month, 1500ms on months with notes); each frame is a complete chart with a caption line.

## Do's and Don'ts

### Do:
- **Do** use the sticker code exactly: solid = actual, ring = forecast, green/amber/coral/slate = state, 1–3 dots = urgency.
- **Do** keep orange for forecast in data marks; use `ser-in`/`ser-out` for series and `seq-1..4` for magnitude.
- **Do** show exact `en-IN` figures with Indian grouping; keep lakh/crore short forms to chart axes and direct labels.
- **Do** make every figure a Show working button, label actual vs forecast, and give every chart a table view.
- **Do** use one y-axis per chart and direct labels instead of legends where they fit.
- **Do** use `minmax(0,1fr)` tracks and `min-width: 0` on new grids.
- **Do** respect `prefers-reduced-motion`; motion only traces or steps through data that is already exact.

### Don't:
- **Don't** use Poppins, serif capitals, or oversized zoomed-in titles; type stays at the modest sizes above.
- **Don't** use emoji icons; icons are inline stroked SVG.
- **Don't** add decoration that carries no meaning, or put any theme behind figures.
- **Don't** add a language switch.
- **Don't** invent metrics the workbook does not hold (ARR, MRR, pipeline).
- **Don't** add 3D; it was tried for the gate and skipped because it added no meaning.
- **Don't** use count-up number animations or animate a line in from nothing.
- **Don't** use sticker colours (green, amber, coral, slate, orange) for non-state series.
- **Don't** add a second y-axis.
- **Don't** apply tabular figures outside columnar contexts.
