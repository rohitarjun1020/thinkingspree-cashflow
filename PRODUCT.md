# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS on GitHub Pages (from the brief): one page, data in its own generated `dashboard-data.js`, a Python refresh script reading the client's Cash Flow workbook. Free CDNs and Google Fonts only; no build step, no paid services, no API keys.

## Users

- Primary: Thinking Spree's founders, reviewing cash each month (laptop and phone).
- Secondary: Strategy Studio Labs (the outsourced CFO team) shows it to other clients as a sample of its CFO work.

## Product Purpose

A monthly cash flow dashboard for Thinking Spree Strategy Advisors Pvt Ltd, a growth consultancy for startups that works in 15-day "T-Sprints" (Map → Sketch → Decide → Prototype → Test). It answers: where cash stands, where it came from and went, what is coming, and whether the books balance. Success: a founder reads the cash position and the next risk in under a minute, and every figure can be traced to the workbook.

## Positioning

The finance view of a founder's strategy room: the same sprint method Thinking Spree sells to startups, applied to its own cash. Runway is read in T-Sprints as well as months.

## Operating Context

- Source: `Cash Flow Forecast - Thinking Spree DDMMYYYY.xlsx`, sent monthly (path under the client database, `.../Financial Control/Cashflow/`). Sheets used: Cash Flow Forecast (weekly actuals since 1 Apr 2025 + monthly summary), Bank Statement, Bank Balance, Outflow Forecast, AR Outstanding, Advances Summary, Bad Debts.
- Forecast basis (user decision, 18 Nov 2026): the Outflow Forecast sheet's monthly budget plus AR Outstanding expected collections, labelled forecast. The workbook's own projection weeks are empty.
- Safety line (user decision): one month of payroll, = average monthly salaries over the last 6 actual months, recalculated each refresh.
- Non-client money (fixed deposit moves, Vani/Sakshi loans, ITR refund, investment activity) is shown separately from client receipts and operating spend; totals still match the workbook.

## Capabilities and Constraints

- Every figure comes from the workbook and reconciles: opening + inflows − outflows = closing for every week and month; totals = sum of lines; cash flow totals = bank statement totals. Checks run in code and surface as a "Books balance" badge.
- Known workbook quirks: weekly opening balances blank from Oct 2026 (rebuild the chain); 13 blank cells in the monthly summary (derive line items from weekly columns); Bank Balance sheet shows mid-month balances for Apr/May/Aug 2026; October 2026 carries two payroll runs.
- Label actual vs forecast wherever it matters.
- No ARR/MRR or other metrics the data does not hold.
- Passcode gate (SHA-256, remembered per device) keeps casual visitors out; it is not real security on a public site.
- "Ask the data": built-in rule-based answers from the data file (free, no login) plus an "Ask Claude" private claude.ai artifact fed the same data pack.

## Brand Commitments

- Client brand cues (thinkingspree.com): deep forest green, warm orange "✦" eyebrow labels, classic serif headline with an italic second line, warm paper tones, a sunlit desk with whiteboard, notebooks and a plant; T-Sprint stages Map → Sketch → Decide → Prototype → Test.
- User rejections (standing, from TMC/Thrive work): generic Poppins + serif capitals, oversized "zoomed-in" titles, emoji icons, decoration with no meaning, a language switch. Theme never sits behind figures. Modest type sizes.

## Evidence on Hand

- Real data only: 88 weeks of actuals (Apr 2025 – Oct 2026), 14 named clients, 19 people/payee salary lines, Outflow Forecast to Dec 2026, AR list, advances register (sessions delivered per programme).
- No contracts, pipeline, or revenue recognition data: do not fabricate pipeline, ARR, or client testimonials.

## Product Principles

1. Accuracy beats atmosphere: if a design idea makes a number less exact or less clear, drop it.
2. Every number can show its working: sheet, row, period, actual or forecast.
3. Say the verdict plainly first, then the detail.
4. The theme is Thinking Spree's own method, used to organise the finance view, never ornament.
5. One-step monthly refresh: new workbook in, dashboard and both chat paths updated.

## Accessibility & Inclusion

Readable on laptop and phone, light and dark, keyboard operable, reduced-motion respected, charts to scale with readable labels.
