# Thinking Spree · Cash

Cash flow dashboard for Thinking Spree Strategy Advisors, built from the monthly *Cash Flow Forecast* workbook.

Six sections, named after the T-Sprint stages:

- **Map** — where cash stands, the one-line verdict, the watch list
- **Sketch** — trends
- **Decide** — what-if
- **Prototype** — four scenarios
- **Test** — the checks
- **Ask** — questions in plain English

Every figure opens its working: the steps, the months, actual or forecast, and the workbook cell it came from.

## How it works

- `tools/refresh.py` reads the workbook and checks it reconciles:
  - weekly and monthly identities,
  - the HDFC statement totals,
  - the sheet's own monthly summary.
- It then writes `dashboard-data.js`.
- `assets/model.js` works out every figure the page shows. It also re-runs the checks in the browser.
- `assets/charts.js` draws the charts as plain SVG; `assets/ask.js` is the built-in, rule-based chat; `assets/app.js` builds the page.
- `tools/test-dashboard.js` is the browser test (Playwright). It checks figures against the raw data, What-if, Replay, Show working, 16 chat questions, and the phone layout.
- The **Ask Claude** page lives outside this repo, in `C:\Users\Rohit SRF\Thinking Spree Ask the Data\`. `refresh.py` rebuilds it automatically.

Monthly steps: see [MONTHLY-UPDATE.md](MONTHLY-UPDATE.md). Design system: see [DESIGN.md](DESIGN.md).

The passcode screen keeps casual visitors out. It is not real security: this repository and the site's data file are public.
