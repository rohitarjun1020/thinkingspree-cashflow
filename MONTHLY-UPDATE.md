# Monthly update — Thinking Spree cash dashboard

About 5 minutes once the new Cash Flow file is saved.

1. **Save the new file** in the usual folder
   `SRF Client Database - CFO Thinking Spree\<year>\<month>\Financial Control\Cashflow\`
   with the usual name: `Cash Flow Forecast - Thinking Spree DDMMYYYY.xlsx`.
2. **Ask Claude:** "Refresh the Thinking Spree dashboard."
   Claude runs `python -I tools/refresh.py`, which finds the newest file, reads it, and rebuilds
   `dashboard-data.js` and the Ask Claude page.
   (To use a particular file: `python -I tools/refresh.py "<full path to the file>"`.)
3. **Read what it prints.**
   - Every check should say **PASS**.
   - The check table should say **match** for the latest month's opening, money in, money out and closing.
   - If anything says FAIL or CHECK, stop and ask Claude to explain it before publishing.
4. **Look at the "Workbook notes".** They list anything odd in the file, such as blank cells or a bad date.
   New notes are worth a quick look with the accounts team.
5. **Test it:** ask Claude to "run the dashboard tests". Every line should say PASS.
6. **Publish:** ask Claude to "push the Thinking Spree dashboard". Then open
   https://rohitarjun1020.github.io/thinkingspree-cashflow/ and check that the top line names the new month.
7. **Update Ask Claude:** ask Claude to "publish the Thinking Spree Ask Claude page"
   (same private link: https://claude.ai/artifact/S3ibYFXMgg3uDGa8F2BLAb).

## Things that need a person, not the script

- **The forecast** comes from the *Outflow Forecast* sheet (budget lines) plus the *AR Outstanding* sheet's
  expected dates. If the budget runs out (it currently stops at December 2026), add the new months to
  that sheet, or the plan will have nothing to show.
- **Expected collection dates** on the AR sheet are worked out from the day the file is opened (TODAY()),
  so they move. Treat them as an assumption.
- **Changing the passcode:** ask Claude to "change the dashboard passcode to …". It stores only a
  scrambled version (a SHA-256 hash) in `assets/app.js`. Everyone will need the new passcode.
  The passcode keeps casual visitors out. It is **not** real security: the site and its data file are public.
