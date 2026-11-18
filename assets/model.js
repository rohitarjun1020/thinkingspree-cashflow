/* Thinking Spree cash model.
   Every figure the dashboard, the built-in chat and the Ask Claude page show is worked out here from
   window.TS_DATA (written by tools/refresh.py from the Cash Flow workbook). Each derived figure carries a
   "working": the steps, the periods, actual or forecast, and the workbook cells it came from. */
(function (root) {
  "use strict";
  const SHEET = "Cash Flow Forecast";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MON_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const SPRINT_DAYS = 15;
  const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
  const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
  const fmtIN = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtIN0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  const MINUS = "−", WJ = "⁠"; /* word joiner keeps "−" and "₹" on one line */

  /* ₹1,92,490.53 (exact, Indian grouping) */
  function inr(v, dp) { const s = v < 0 ? MINUS + WJ : ""; const a = Math.abs(r2(v)); return s + "₹" + (dp === 0 ? fmtIN0.format(Math.round(a)) : fmtIN.format(a)); }
  /* ₹1.92L / ₹1.24Cr / ₹48,000 (short, for charts and prose) */
  function lakh(v, dp) {
    const a = Math.abs(v), s = v < 0 ? MINUS + WJ : "", d = dp == null ? 2 : dp;
    if (a >= 1e7) return s + "₹" + (a / 1e7).toFixed(d) + "Cr";
    if (a >= 1e5) return s + "₹" + (a / 1e5).toFixed(d) + "L";
    return s + "₹" + fmtIN0.format(Math.round(a));
  }
  const pct = (v, dp) => (v * 100).toFixed(dp == null ? 0 : dp) + "%";
  const monthLabel = (key, long) => { const m = +key.slice(5) - 1; return (long ? MON_LONG[m] : MON[m]) + " " + key.slice(0, 4); };
  const monthShort = (key) => MON[+key.slice(5) - 1] + " ’" + key.slice(2, 4);
  const daysIn = (key) => new Date(+key.slice(0, 4), +key.slice(5), 0).getDate();
  const nextKey = (key) => { let y = +key.slice(0, 4), m = +key.slice(5) + 1; if (m > 12) { m = 1; y++; } return y + "-" + String(m).padStart(2, "0"); };
  const dateLabel = (iso) => { const d = new Date(iso + "T00:00:00"); return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); };
  const fyOf = (key) => (+key.slice(5) >= 4 ? +key.slice(0, 4) : +key.slice(0, 4) - 1);
  const fyName = (y) => "FY" + String(y).slice(2) + "–" + String(y + 1).slice(2);
  const titleCase = (s) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Llp|Pvt|Ltd)\b/g, (w) => w.toUpperCase()).replace(/\bAnd\b/g, "and").replace(/\bOf\b/g, "of") : s);
  const SHORT_NAMES = { "National Entrepreneurship Network": "NEN", "International Foundation For Research And Education": "IFRE", "Indian School Of Business": "ISB", "Aic Isb Association": "AIC-ISB", "Dlabs Incubator Association": "DLabs", "Elecroom Technologies Private Limited": "Elecroom", "ELECROOM TECHNOLOGIES PRIVATE LIMITED": "Elecroom", "TRAVEZY GLOBAL LLP": "Travezy", "WINSPIRE EDUCATIONAL SOLUTIONS PRIVATE LIMITED": "WInspire", "SERENDIPITY ARTS FOUNDATION": "Serendipity Arts", "PANGEEA REALTY 44 PRIVATE LIMITED": "Pangeea Realty", "Dharti Bionest Incubation Centres, Dharti Foundation": "Dharti Bionest", "Reserve Bank Innovation Hub": "RBIH", "Ashoka University": "Ashoka University" };
  const nice = (name) => { const n = String(name).replace(/\s+/g, " ").trim(); return titleCase(n).replace(/Private Limited$/i, "Pvt Ltd"); };
  const short = (name) => SHORT_NAMES[String(name).replace(/\s+/g, " ").trim()] || nice(name);

  function create(D) {
    const meta = D.meta, rows = meta.rows;
    const L = {}; D.lines.forEach((l) => (L[l.id] = l));
    const W = D.weeks;
    const cellRef = (row, col) => `${SHEET} · row ${row} · column ${col}`;

    /* ---------- actual months, enriched ---------- */
    const months = D.months.map((m, i) => {
      const g = {}; let clientIn = 0, otherIn = 0, opOut = 0, nonopOut = 0;
      for (const k in m.v) {
        const l = L[k], x = m.v[k];
        g[l.group] = (g[l.group] || 0) + x;
        if (l.dir === "in") { if (l.client) clientIn += x; else otherIn += x; } else { if (l.nonop) nonopOut += x; else opOut += x; }
      }
      for (const k in g) g[k] = r2(g[k]);
      return Object.assign({}, m, { i, actual: true, short: monthShort(m.key), long: monthLabel(m.key, true), groups: g, clientIn: r2(clientIn), otherIn: r2(otherIn), opOut: r2(opOut), nonopOut: r2(nonopOut), net: r2(m.inflow - m.outflow), fy: fyOf(m.key) });
    });
    const MK = {}; months.forEach((m) => (MK[m.key] = m));
    const last = months[months.length - 1], prevM = months[months.length - 2];
    const curFY = fyOf(last.key);
    const fyMonths = (y) => months.filter((m) => m.fy === y);

    /* working helpers */
    const src = { month: (m, field) => cellRef(rows[field], m.sheet ? m.sheet.col : "(weekly sum)") + ` (${m.long} monthly summary)`,
      weeks: (m, row) => `${SHEET} · row ${row} · columns ${W[m.weeks[0]].col}–${W[m.weeks[m.weeks.length - 1]].col} (weeks of ${m.long})` };
    function work(title, value, status, steps, note, formula) { return { title, value, status, steps: steps || [], note: note || "", formula: formula || "" }; }
    const monthWork = (m, field, title) => {
      const names = { open: "Opening balance", inflow: "Money in", outflow: "Money out", close: "Closing balance" };
      const steps = field === "close"
        ? [{ label: "Opening balance", value: inr(m.open), src: src.month(m, "open") }, { label: "+ Money in", value: inr(m.inflow), src: src.month(m, "inflow") }, { label: MINUS + " Money out", value: inr(m.outflow), src: src.month(m, "outflow") }, { label: "= Closing balance", value: inr(m.close), src: src.month(m, "close") }]
        : [{ label: names[field] + ", " + m.long, value: inr(m[field]), src: src.month(m, field) }, { label: "Same figure as the sum of its " + m.weeks.length + " weeks", value: inr(m[field]), src: src.weeks(m, rows[field]) }];
      return work(title || names[field] + " · " + m.long, inr(m[field]), "actual", steps, field === "close" ? "Matches the HDFC statement and the sheet's monthly summary." : "", field === "close" ? "Opening + in − out" : "");
    };

    /* ---------- safety line: one month of payroll ---------- */
    const SAFE_N = 6;
    const safeMonths = months.slice(-SAFE_N);
    const safety = (() => {
      const v = r2(sum(safeMonths, (m) => m.groups.salaries || 0) / safeMonths.length);
      return { value: v, months: safeMonths.map((m) => m.key), working: work("Safety line · one month of payroll", inr(v), "actual",
        safeMonths.map((m) => ({ label: "Salaries & consultants, " + m.long, value: inr(m.groups.salaries || 0), src: cellRef(meta.groupRows.salaries, m.sheet ? m.sheet.col : "") }))
          .concat([{ label: "Average of " + safeMonths.length + " months", value: inr(v), src: "" }]),
        "Average monthly salaries over the last six actual months, recalculated every refresh. " + (safeMonths.some((m) => (m.groups.salaries || 0) > 1.5 * v) ? "October 2026 carries two payroll runs, which lifts the average." : ""), "Sum of salaries ÷ 6") };
    })();

    /* ---------- runway: how long cash lasts if nothing comes in ---------- */
    const runway = (() => {
      const ms = months.slice(-SAFE_N), out = sum(ms, (m) => m.opOut), days = sum(ms, (m) => daysIn(m.key));
      const daily = out / days, d = last.close / daily;
      return { days: d, sprints: d / SPRINT_DAYS, months: last.close / (out / ms.length), daily, monthly: out / ms.length,
        working: work("Runway", Math.floor(d) + " days · " + (d / SPRINT_DAYS).toFixed(1) + " T-Sprints", "actual", [
          { label: "Cash at " + dateLabel(meta.actualTo), value: inr(last.close), src: src.month(last, "close") },
          { label: "Operating spend, " + ms[0].long + "–" + ms[ms.length - 1].long, value: inr(out), src: SHEET + " · row " + rows.outflow + " less row " + meta.groupRows.investment + " (fixed deposit)" },
          { label: "Days in those months", value: String(days), src: "" },
          { label: "Spend per day", value: inr(daily), src: "" },
          { label: "Cash ÷ spend per day", value: d.toFixed(1) + " days", src: "" },
          { label: "÷ 15 days per T-Sprint", value: (d / SPRINT_DAYS).toFixed(2) + " T-Sprints", src: "" }],
          "Assumes no money comes in and spending runs at the last six months' pace. A T-Sprint is Thinking Spree's 15-day sprint.", "Cash ÷ average daily spend") };
    })();

    /* ---------- forecast engine (also the What-if engine) ---------- */
    const budget = D.budget;
    const fcKeys = budget.months.filter((k) => k > last.key);
    const horizonEnd = fcKeys.length ? fcKeys[fcKeys.length - 1] : last.key;
    const arItems = D.ar.map((a) => Object.assign({}, a, { short: short(a.customer), name: nice(a.customer) }));
    const clientFY = fyMonths(curFY);
    const paceIn = r2(sum(clientFY, (m) => m.clientIn) / clientFY.length);
    const recentOut = runway.monthly;
    const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

    /* opts: { delay:{invoice:days}, cut:{budgetRow:pct 0-100}, retainer:{amount, from:key}, receipts:"ar"|"none"|"pace", spend:"budget"|"recent" } */
    function forecast(opts) {
      opts = opts || {};
      const delay = opts.delay || {}, cut = opts.cut || {}, ret = opts.retainer || null;
      const receiptsMode = opts.receipts || "ar", spendMode = opts.spend || "budget";
      let open = last.close; const out = [];
      fcKeys.forEach((key) => {
        const lines = [], receipts = [];
        if (spendMode === "budget") {
          budget.lines.forEach((b) => {
            const base = b.v[key] || 0; if (!base) return;
            const c = cut[b.row] || 0, amt = r2(base * (1 - c / 100));
            lines.push({ row: b.row, name: b.name, section: b.section, base, amount: amt, cut: c, src: "Outflow Forecast · row " + b.row + " · " + monthLabel(key) });
          });
        } else {
          lines.push({ row: null, name: "Spend at the last six months' pace", base: r2(recentOut), amount: r2(recentOut), cut: 0, src: SHEET + " · row " + rows.outflow + ", average of " + safeMonths[0].short + "–" + last.short });
        }
        if (receiptsMode === "ar") {
          arItems.forEach((a) => {
            if (!a.expected) return;
            const d = addDays(a.expected, delay[a.invoice] || 0);
            if (d.slice(0, 7) === key) receipts.push({ name: a.short + " invoice " + a.invoice, amount: a.amount, date: d, delayed: delay[a.invoice] || 0, src: "AR Outstanding · row " + a.row });
          });
        } else if (receiptsMode === "pace") {
          receipts.push({ name: "Client receipts at " + fyName(curFY) + " pace", amount: paceIn, date: key + "-15", src: "Average client receipts " + clientFY[0].short + "–" + last.short + " (" + SHEET + " rows 12–26)" });
        }
        if (ret && ret.amount > 0 && key >= (ret.from || fcKeys[0])) receipts.push({ name: "New retainer (what-if)", amount: r2(ret.amount), date: key + "-01", src: "What-if input", whatif: true });
        const inflow = r2(sum(receipts, (r) => r.amount)), outflow = r2(sum(lines, (l) => l.amount));
        const close = r2(open + inflow - outflow);
        out.push({ key, label: monthLabel(key), long: monthLabel(key, true), short: monthShort(key), actual: false, open: r2(open), inflow, outflow, close, lines, receipts });
        open = close;
      });
      const slipped = arItems.filter((a) => a.expected && addDays(a.expected, delay[a.invoice] || 0).slice(0, 7) > horizonEnd).map((a) => ({ name: a.short, amount: a.amount, date: addDays(a.expected, delay[a.invoice] || 0) }));
      return { months: out, slipped, end: out.length ? out[out.length - 1].close : last.close };
    }
    const plan = forecast({});
    const whatIf = (o) => forecast(Object.assign({}, o, { receipts: "ar", spend: "budget" }));
    const fcWork = (f) => work(f.long + " closing (forecast)", inr(f.close), "forecast", [
      { label: "Opening (" + (f.key === fcKeys[0] ? "actual close " + last.long : "forecast") + ")", value: inr(f.open), src: f.key === fcKeys[0] ? src.month(last, "close") : "previous forecast month" }]
      .concat(f.receipts.map((r) => ({ label: "+ " + r.name + " (" + dateLabel(r.date) + ")", value: inr(r.amount), src: r.src })))
      .concat(f.lines.map((l) => ({ label: MINUS + " " + l.name + (l.cut ? " (cut " + l.cut + "%)" : ""), value: inr(l.amount), src: l.src })))
      .concat([{ label: "= Closing", value: inr(f.close), src: "" }]),
      "Forecast: spend from the Outflow Forecast sheet (full lines, including GST and TDS, which the sheet's own total leaves out); receipts only where AR Outstanding gives an expected date. Directors' salaries are not in the budget (sheet remark).", "Opening + expected receipts − budget lines");

    /* ---------- scenarios (Prototype) ---------- */
    const pOut = plan.months.map((f) => f.outflow);
    const budgetTxt = pOut.length && pOut.every((v) => v === pOut[0]) ? inr(pOut[0], 0) + " a month" : plan.months.map((f) => inr(f.outflow, 0) + " in " + f.short).join(" and ");
    const openAR = arItems.filter((a) => a.expected), arN = openAR.length, arTot = r2(sum(openAR, (a) => a.amount));
    const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
    const invTxt = (arN < NUM.length ? NUM[arN] : arN) + " unpaid invoice" + (arN === 1 ? "" : "s") + " (" + inr(arTot, 0) + ")";
    const arWhen = [...new Set(openAR.map((a) => dateLabel(a.expected)))].join(" and ");
    const isAre = arN === 1 ? "is" : "are";
    const scenarios = [
      { id: "plan", name: "The plan as it stands", note: "We spend what the budget sheet lists (" + budgetTxt + "). The only money coming in is the " + invTxt + ", paid when the AR sheet expects" + (arWhen ? " (" + arWhen + ")" : "") + ".", f: plan },
      { id: "pace", name: "Clients keep paying like this year", note: "Spending as in the plan. But instead of only the " + invTxt + ", clients keep paying " + inr(paceIn, 0) + " a month: the average for " + clientFY[0].short + "–" + last.short + " (" + fyName(curFY) + ").", f: forecast({ receipts: "pace" }) },
      { id: "slip", name: "The unpaid invoices are late", note: "Spending as in the plan, but the " + invTxt + " " + isAre + " not paid before " + monthLabel(horizonEnd, true) + " ends. No money comes in.", f: forecast({ receipts: "none" }) },
      { id: "recent", name: "Spending stays at recent levels", note: "We spend " + inr(recentOut, 0) + " a month, the average of the last six months (" + safeMonths[0].short + "–" + last.short + "), instead of the budget (" + budgetTxt + "). The " + invTxt + " " + isAre + " paid when the AR sheet expects.", f: forecast({ spend: "recent" }) },
    ];

    /* ---------- the verdict ---------- */
    const verdict = (() => {
      const neg = plan.months.find((f) => f.close < 0), low = plan.months.find((f) => f.close < safety.value);
      let head, tail, tone;
      head = "Cash closed " + MON_LONG[+last.key.slice(5) - 1] + " at " + inr(last.close, 0) + ".";
      if (neg) { tail = "On the plan, it runs out in " + neg.long + "."; tone = "critical"; }
      else if (low) { tail = "On the plan it stays positive but dips below the safety line in " + low.long + "."; tone = "warn"; }
      else { tail = "On the plan it stays above " + lakh(safety.value) + " through " + monthLabel(horizonEnd, true) + "."; tone = "good"; }
      const f0 = plan.months[0];
      const sub = neg
        ? `${f0.long} budget is ${inr(f0.outflow, 0)} and ${f0.inflow ? inr(f0.inflow, 0) + " is" : "nothing is"} expected in, so cash would reach ${inr(f0.close, 0)}. ${neg.key === f0.key ? "To stay at zero, " + inr(-f0.close, 0) + " must come in during " + f0.long.split(" ")[0] + "." : ""}`
        : "";
      return { head, tail, tone, sub, working: fcWork(neg || low || plan.months[plan.months.length - 1]) };
    })();

    /* ---------- FY figures ---------- */
    function periodTotals(ms, name) {
      const t = { months: ms, inflow: r2(sum(ms, (m) => m.inflow)), outflow: r2(sum(ms, (m) => m.outflow)), clientIn: r2(sum(ms, (m) => m.clientIn)), otherIn: r2(sum(ms, (m) => m.otherIn)), opOut: r2(sum(ms, (m) => m.opOut)), nonopOut: r2(sum(ms, (m) => m.nonopOut)) };
      t.name = name; t.range = ms[0].short + "–" + ms[ms.length - 1].short;
      const byLine = {}; ms.forEach((m) => { for (const k in m.v) byLine[k] = (byLine[k] || 0) + m.v[k]; });
      t.clients = D.lines.filter((l) => l.client && byLine[l.id]).map((l) => ({ id: l.id, row: l.row, name: nice(l.name), short: short(l.name), amount: r2(byLine[l.id]) })).sort((a, b) => b.amount - a.amount);
      t.clients.forEach((c) => (c.share = t.clientIn ? c.amount / t.clientIn : 0));
      const groups = {}; ms.forEach((m) => { for (const g in m.groups) groups[g] = (groups[g] || 0) + m.groups[g]; });
      t.spend = Object.keys(groups).filter((g) => D.lines.some((l) => l.group === g && l.dir === "out") && groups[g] > 0).map((g) => ({ id: g, row: meta.groupRows[g], name: meta.groupNames[g], amount: r2(groups[g]), nonop: g === "investment" })).sort((a, b) => b.amount - a.amount);
      t.other = D.lines.filter((l) => l.dir === "in" && !l.client && byLine[l.id]).map((l) => ({ row: l.row, name: nice(l.name), amount: r2(byLine[l.id]) }));
      t.byLine = byLine;
      t.work = (field, title) => work(title + " · " + t.name, inr(t[field]), "actual", ms.map((m) => ({ label: m.long, value: inr(m[field]), src: src.month(m, field === "clientIn" || field === "inflow" || field === "otherIn" ? "inflow" : "outflow") }))
        .concat([{ label: "Total, " + ms.length + " months", value: inr(t[field]), src: "" }]), field === "clientIn" ? "Client receipts only: rows 12–26. Loans, the fixed deposit and the tax refund are left out." : field === "opOut" ? "Operating spend: everything except the fixed deposit placed (row " + meta.groupRows.investment + ")." : "", "Sum of months");
      return t;
    }
    const fyTotals = (y) => { const ms = fyMonths(y); return periodTotals(ms, fyName(y) + (ms.length < 12 ? " to date" : "")); };
    /* any run of actual months, e.g. rangeTotals("2025-06", "2026-03") */
    function rangeTotals(from, to) {
      if (from > to) { const x = from; from = to; to = x; }
      const ms = months.filter((m) => m.key >= from && m.key <= to);
      if (!ms.length) return null;
      const a = ms[0], b = ms[ms.length - 1];
      const name = ms.length === months.length ? "All " + ms.length + " months" : a.key === b.key ? a.long : a.long + " – " + b.long;
      return periodTotals(ms, name);
    }
    const FY = fyTotals(curFY), FYprev = fyMonths(curFY - 1).length ? fyTotals(curFY - 1) : null;

    /* ---------- what changed vs the month before ---------- */
    const changes = (() => {
      const out = [];
      D.lines.forEach((l) => {
        const a = last.v[l.id] || 0, b = prevM.v[l.id] || 0;
        if (Math.abs(a - b) >= 1) out.push({ id: l.id, row: l.row, name: nice(l.name), dir: l.dir, now: a, before: b, diff: r2(a - b) });
      });
      out.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
      return out;
    })();

    /* ---------- watch list: sticker dots, calculated ---------- */
    const watch = (() => {
      const items = [];
      const f0 = plan.months[0];
      const neg = plan.months.find((f) => f.close < 0);
      if (neg) items.push({ id: "plan-negative", dots: 3, forecast: true, title: "Plan runs out of cash in " + neg.long, amount: inr(neg.close, 0), note: f0.long + " budget " + inr(f0.outflow, 0) + " against cash " + inr(last.close, 0) + "; " + (f0.inflow ? inr(f0.inflow, 0) : "nothing") + " expected in", working: fcWork(neg) });
      else if (plan.months.some((f) => f.close < safety.value)) { const lo = plan.months.find((f) => f.close < safety.value); items.push({ id: "plan-low", dots: 2, forecast: true, title: "Plan dips below the safety line in " + lo.long, amount: inr(lo.close, 0), note: "Safety line " + inr(safety.value, 0), working: fcWork(lo) }); }
      const sal = f0 && f0.lines.find((l) => /salar/i.test(l.name));
      if (sal && sal.amount > last.close) items.push({ id: "big-payroll", dots: 2, forecast: true, title: "Salaries of " + inr(sal.amount, 0) + " due in " + f0.long.split(" ")[0], amount: pct(last.close / sal.amount) + " covered", note: "Cash today covers " + pct(last.close / sal.amount) + " of it", working: work("Next payroll vs cash", pct(last.close / sal.amount), "forecast", [{ label: "Salaries budget, " + f0.long, value: inr(sal.amount), src: sal.src }, { label: "Cash at " + dateLabel(meta.actualTo), value: inr(last.close), src: src.month(last, "close") }, { label: "Cash ÷ salaries", value: pct(last.close / sal.amount, 1), src: "" }]) });
      arItems.forEach((a) => {
        const d = a.daysOverdue; if (!d) return;
        items.push({ id: "ar-" + a.invoice, dots: d >= 90 ? 2 : 1, forecast: false, title: a.short + " invoice open " + d + " days", amount: inr(a.amount, 0), note: (a.status || "Open") + " · invoiced " + dateLabel(a.invoiceDate) + " · sheet expects " + (a.expected ? dateLabel(a.expected) : "no date"), working: work(a.name + " · " + a.invoice, inr(a.amount), "actual", [{ label: "Invoice date", value: dateLabel(a.invoiceDate), src: "AR Outstanding · row " + a.row }, { label: "Due date", value: a.due ? dateLabel(a.due) : "–", src: "AR Outstanding · row " + a.row }, { label: "Amount open", value: inr(a.amount), src: "AR Outstanding · row " + a.row + " · column H" }, { label: "Days since invoice (as saved " + meta.saved.slice(0, 10) + ")", value: String(d), src: "AR Outstanding · row " + a.row + " · column I" }, { label: "Expected collection (assumption)", value: a.expected ? dateLabel(a.expected) : "–", src: "AR Outstanding · column K (30 days after the file was opened)" }], "The sheet's overdue count and expected date are TODAY()-based formulas; these are the values as saved.") });
      });
      const top = FY.clients[0];
      if (top && top.share >= 0.25) items.push({ id: "concentration", dots: top.share >= 0.33 ? 2 : 1, forecast: false, title: top.short + " paid " + pct(top.share) + " of client receipts", amount: inr(top.amount, 0), note: FY.name + " (" + FY.range + "); top three " + pct(sum(FY.clients.slice(0, 3), (c) => c.share)), working: work("Client concentration · " + FY.name, pct(top.share, 1), "actual", FY.clients.slice(0, 5).map((c) => ({ label: c.name, value: inr(c.amount) + " · " + pct(c.share, 1), src: SHEET + " · row " + c.row })).concat([{ label: "All client receipts", value: inr(FY.clientIn), src: SHEET + " · rows 12–26" }])) });
      const advLeft = sum(D.advances, (a) => a.balance), advS = sum(D.advances, (a) => a.sessionsLeft);
      if (advLeft > 0) items.push({ id: "advances", dots: 1, forecast: false, title: advS + " sessions still owed on advances", amount: inr(advLeft, 0), note: "Cash already received; the work is still to deliver", working: work("Advances still to deliver", inr(advLeft), "actual", D.advances.map((a) => ({ label: nice(a.client) + " · " + a.sessionsLeft + " sessions", value: inr(a.balance), src: "Advances Summary · row " + a.row })).concat([{ label: "Total", value: inr(advLeft), src: "" }]), "Received as advances, not yet delivered: a commitment of the team's time, not a payment due.") });
      const below = months.filter((m) => m.close < safety.value);
      if (below.length) items.push({ id: "below-safety", dots: below.length / months.length >= 0.5 ? 1 : 1, forecast: false, title: below.length + " of " + months.length + " months closed below the safety line", amount: inr(safety.value, 0), note: "Last time: " + below[below.length - 1].long, working: work("Months below the safety line", below.length + " of " + months.length, "actual", below.map((m) => ({ label: m.long, value: inr(m.close), src: src.month(m, "close") })), "Safety line = " + inr(safety.value) + " (one month of payroll, today's average) applied to every month.") });
      const ob = budget.lines.reduce((s, b) => s + (b.v[last.key] || 0), 0);
      if (ob && last.opOut > ob * 1.1) items.push({ id: "over-budget", dots: 1, forecast: false, title: last.long.split(" ")[0] + " spent " + pct(last.opOut / ob - 1) + " over its budget", amount: inr(last.opOut - ob, 0), note: "Actual " + inr(last.opOut, 0) + " vs budget " + inr(ob, 0), working: work("Budget vs actual · " + last.long, inr(last.opOut - ob), "actual", [{ label: "Operating spend (actual)", value: inr(last.opOut), src: src.month(last, "outflow") }, { label: "Budget lines (Outflow Forecast)", value: inr(ob), src: "Outflow Forecast · rows " + budget.lines[0].row + "–" + budget.lines[budget.lines.length - 1].row }], (last.groups.salaries || 0) > 1.5 * safety.value / 1.2 ? "October paid two payroll runs (September's salaries on 1–8 Oct and October's on 27 Oct)." : "") });
      items.sort((a, b) => b.dots - a.dots);
      const pv = D.prev;
      items.forEach((it) => { it.changed = !!(pv && pv.ar && /^ar-/.test(it.id) && !pv.ar[it.id.slice(3)]); });
      return items;
    })();

    /* ---------- key moments for Replay ---------- */
    const moments = (() => {
      const out = [];
      const lo = months.reduce((a, b) => (b.close < a.close ? b : a)), hi = months.reduce((a, b) => (b.close > a.close ? b : a));
      const bigIn = months.reduce((a, b) => (b.clientIn > a.clientIn ? b : a));
      out.push({ key: lo.key, text: "Lowest month-end: " + inr(lo.close) });
      out.push({ key: hi.key, text: "Highest month-end: " + inr(hi.close, 0) });
      out.push({ key: bigIn.key, text: "Best month for client receipts: " + inr(bigIn.clientIn, 0) });
      months.forEach((m) => { if (m.nonopOut >= 1e5) out.push({ key: m.key, text: inr(m.nonopOut, 0) + " placed in a fixed deposit" }); const fd = D.lines.find((l) => /fixed deposit/i.test(l.name)); if (fd && (m.v[fd.id] || 0) >= 1e5) out.push({ key: m.key, text: inr(m.v[fd.id], 0) + " fixed deposit came back" }); });
      months.forEach((m) => { if ((m.groups.salaries || 0) > 1.6 * safety.value / 1.25 && (m.groups.salaries || 0) > 1.6 * (sum(months.slice(-7, -1), (x) => x.groups.salaries || 0) / 6)) out.push({ key: m.key, text: "Two payroll runs: " + inr(m.groups.salaries, 0) }); });
      const neg = plan.months.find((f) => f.close < 0); if (neg) out.push({ key: neg.key, text: "Plan goes below zero", forecast: true });
      const seen = {}; return out.filter((x) => { const k = x.key + x.text; if (seen[k]) return false; seen[k] = 1; return true; }).sort((a, b) => (a.key < b.key ? -1 : 1));
    })();

    /* ---------- checks (re-run in the browser, independent of refresh.py) ---------- */
    function runChecks() {
      const out = []; const T = 0.005;
      const add = (id, name, ok, detail) => out.push({ id, name, ok, detail });
      const badW = W.filter((w) => Math.abs(w.open + w.inflow - w.outflow - w.close) > T);
      add("week-identity", "Every week: opening + in − out = closing", !badW.length, (W.length - badW.length) + " of " + W.length + " weeks");
      const badChain = W.filter((w, i) => i && Math.abs(W[i - 1].close - w.open) > T);
      add("week-chain", "Every week opens where the last one closed", !badChain.length, (W.length - 1 - badChain.length) + " of " + (W.length - 1) + " links");
      const badL = W.filter((w) => { let i = 0, o = 0; for (const k in w.v) (L[k].dir === "in" ? (i += w.v[k]) : (o += w.v[k])); return Math.abs(i - w.inflow) > T || Math.abs(o - w.outflow) > T; });
      add("week-lines", "Every week: its lines add up to its In and Out totals", !badL.length, (W.length - badL.length) + " of " + W.length + " weeks");
      const badM = months.filter((m) => Math.abs(m.open + m.inflow - m.outflow - m.close) > T || (m.sheet && ["open", "inflow", "outflow", "close"].some((k) => Math.abs(m[k] - m.sheet[k]) > T)));
      add("month-sheet", "Every month balances and equals the sheet's monthly summary", !badM.length, (months.length - badM.length) + " of " + months.length + " months");
      const tin = sum(W, (w) => w.inflow), tout = sum(W, (w) => w.outflow);
      add("bank-in", "All money in equals the HDFC statement's deposits", Math.abs(tin - D.bank.deposits) <= T, inr(tin) + " = " + inr(D.bank.deposits));
      add("bank-out", "All money out equals the HDFC statement's withdrawals", Math.abs(tout - D.bank.withdrawals) <= T, inr(tout) + " = " + inr(D.bank.withdrawals));
      add("bank-close", "Closing cash equals the statement's last balance", Math.abs(last.close - D.bank.lastBalance) <= T, inr(last.close));
      const badF = plan.months.filter((f) => Math.abs(f.open + f.inflow - f.outflow - f.close) > T || Math.abs(sum(f.lines, (l) => l.amount) - f.outflow) > T);
      add("forecast", "Forecast months balance and equal the sum of their budget lines", !badF.length, plan.months.length + " forecast months");
      const wi = whatIf({ delay: {}, cut: {}, retainer: { amount: 0 } });
      add("whatif-zero", "What-if with no changes reproduces the plan exactly", wi.months.every((f, i) => f.close === plan.months[i].close && f.inflow === plan.months[i].inflow && f.outflow === plan.months[i].outflow), wi.months.map((f) => inr(f.close)).join(", "));
      return out;
    }
    const checks = runChecks();
    /* months that are new or different since the previous data file (they stay lit until the next refresh) */
    const changedKeys = (() => { const pv = D.prev; if (!pv || !pv.months) return []; return months.filter((m) => { const o = pv.months[m.key]; return !o || ["inflow", "outflow", "close"].some((k) => Math.abs(o[k] - m[k]) > 0.005); }).map((m) => m.key); })();

    return {
      D, meta, months, MK, weeks: W, last, prevM, curFY, FY, FYprev, fyTotals, rangeTotals, fyMonths, fyName, safety, runway, plan, forecast, whatIf, fcWork, monthWork,
      scenarios, verdict, watch, changes, changedKeys, moments, checks, runChecks, arItems, paceIn, recentOut, fcKeys, horizonEnd, budget, lines: L,
      inr, lakh, pct, monthLabel, monthShort, dateLabel, nice, short, work, cellRef, SPRINT_DAYS, MON, MON_LONG,
    };
  }

  const api = { create };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.TSModel = api;
})(typeof window !== "undefined" ? window : globalThis);
