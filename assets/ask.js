/* Thinking Spree · Cash — "Ask the data": a rule-based answerer. Free, offline, no AI.
   Every answer is computed from the same TSModel the dashboard uses and returns: a sentence, key facts, a small
   table, the periods covered, actual vs forecast, and the workbook source. If it does not understand, it says so
   and offers the closest questions it can answer. */
(function (root) {
  "use strict";
  const MONTHS = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
  const norm = (s) => String(s).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9₹.'\- ]+/g, " ").replace(/\s+/g, " ").trim();
  const has = (q, re) => re.test(q);

  function create(M) {
    const { inr, lakh, pct } = M;
    const SHEET = "Cash Flow Forecast";
    const allKeys = M.months.map((m) => m.key).concat(M.plan.months.map((f) => f.key));
    const planK = {}; M.plan.months.forEach((f) => (planK[f.key] = f));
    const clientList = M.FY.clients.concat(M.FYprev ? M.FYprev.clients : []).reduce((a, c) => (a.some((x) => x.id === c.id) ? a : a.concat([c])), []);
    const suggestions = [
      "What is the cash balance now?",
      "How much came in and went out in October?",
      "What were the top costs this year?",
      "Which clients paid us this year?",
      "How long will the cash last?",
      "What changed vs last month?",
      "What does the plan say for December?",
      "Who still owes us money?",
      "How much did NEN pay this year?",
      "Do the books balance?",
    ];

    /* ---------- period parsing ---------- */
    function findMonth(q) {
      const re = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?\s*'?(\d{4}|\d{2})?\b/;
      const mm = q.match(re); if (!mm) return null;
      if (mm[1] === "may" && !mm[2] && !/\bin may\b|\bmay (cash|balance|spend)|^may\b|\bfor may\b|\bof may\b|\bduring may\b/.test(q)) return null;
      const mo = MONTHS[mm[1]]; let yr = mm[2] ? +mm[2] : null; if (yr && yr < 100) yr += 2000;
      const cands = allKeys.filter((k) => +k.slice(5) === mo && (!yr || +k.slice(0, 4) === yr));
      if (!cands.length) return { missing: M.MON_LONG[mo - 1] + (yr ? " " + yr : "") };
      return { key: cands[cands.length - 1], other: !yr && cands.length > 1 ? cands.slice(0, -1) : [] };
    }
    function period(q) {
      if (/\b(last|previous) month\b/.test(q)) return { kind: "month", key: M.last.key };
      if (/\b(this|current|latest) month\b|\bnow\b|\btoday\b|\bcurrent(ly)?\b|\blatest\b/.test(q) && !findMonth(q)) return { kind: "now", key: M.last.key };
      if (/\bnext month\b/.test(q)) return { kind: "month", key: M.fcKeys[0] };
      const fy = q.match(/\bfy\s?'?(\d{2,4})(?:\s?[-–\/]\s?(\d{2,4}))?\b/);
      if (fy) { let y = +fy[1]; if (y < 100) y += 2000; if (!fy[2] && y > M.curFY) y -= 1; const ms = M.fyMonths(y); if (ms.length) return { kind: "fy", fy: y }; }
      if (/\blast (financial |fiscal )?year\b|\bprevious year\b/.test(q) && M.FYprev) return { kind: "fy", fy: M.curFY - 1 };
      if (/\bthis (financial |fiscal )?year\b|\bthis fy\b|\byear to date\b|\bytd\b|\bso far\b|\bthis year\b/.test(q)) return { kind: "fy", fy: M.curFY };
      if (/\ball time\b|\bsince (the )?start\b|\bever\b|\boverall\b|\bin total\b|\ball months\b/.test(q)) return { kind: "all" };
      const fm = findMonth(q); if (fm) return fm.missing ? { kind: "missing", text: fm.missing } : { kind: "month", key: fm.key, other: fm.other };
      return null;
    }
    const isFc = (k) => !!planK[k] && !M.MK[k];
    const mOf = (k) => M.MK[k] || planK[k];
    function msFor(p) {
      if (!p || p.kind === "all") return M.months;
      if (p.kind === "fy") return M.fyMonths(p.fy);
      return [M.MK[p.key]].filter(Boolean);
    }
    const pLabel = (p) => (!p || p.kind === "all" ? M.months[0].long + " – " + M.last.long + " (all " + M.months.length + " months)" : p.kind === "fy" ? M.fyName(p.fy) + (p.fy === M.curFY ? " to date (" + M.FY.range + ")" : "") : mOf(p.key).long);
    const status = (p) => (p && p.key && isFc(p.key) ? "forecast" : "actual");
    const ans = (o) => Object.assign({ facts: [], table: null, suggest: [], status: "actual", periods: "", source: "" }, o);
    const otherNote = (p) => (p && p.other && p.other.length ? " (For " + p.other.map((k) => M.monthLabel(k, true)).join(", ") + ", add the year.)" : "");

    /* ---------- intents ---------- */
    function closing(p) {
      const key = p && p.key ? p.key : M.last.key;
      if (isFc(key)) {
        const f = planK[key];
        return ans({ text: "On the plan, cash would close " + f.long + " at " + inr(f.close) + ". This is a forecast: budget lines from the Outflow Forecast sheet and receivables on the AR sheet's expected dates." + otherNote(p),
          facts: [{ l: "Opening (forecast)", v: inr(f.open) }, { l: "Expected in", v: inr(f.inflow) }, { l: "Budgeted out", v: inr(f.outflow) }, { l: "Closing (forecast)", v: inr(f.close) }],
          table: { head: ["Item", "Amount"], align: ["l", "r"], rows: f.receipts.map((r) => ["+ " + r.name, inr(r.amount)]).concat(f.lines.map((l) => ["− " + l.name, inr(l.amount)])) },
          status: "forecast", periods: f.long, source: "Outflow Forecast sheet · AR Outstanding sheet", w: "fc:" + key });
      }
      const m = M.MK[key];
      const tail = M.MK[key] === M.last ? " That is the last actual figure; the bank statement shows the same " + inr(M.D.bank.lastBalance) + " on " + M.dateLabel(M.D.bank.lastTxn) + "." : "";
      return ans({ text: "Cash closed " + m.long + " at " + inr(m.close) + "." + tail + otherNote(p),
        facts: [{ l: "Opening", v: inr(m.open) }, { l: "Money in", v: inr(m.inflow) }, { l: "Money out", v: inr(m.outflow) }, { l: "Closing", v: inr(m.close) }],
        table: { head: ["Month", "Closing"], align: ["l", "r"], rows: M.months.slice(Math.max(0, m.i - 3), m.i + 1).map((x) => [x.long, inr(x.close)]) },
        status: "actual", periods: m.long, source: SHEET + " · row " + M.meta.rows.close + " · column " + (m.sheet ? m.sheet.col : ""), w: "m:" + key + ":close" });
    }
    function flows(p, which) {
      if (p && p.key && isFc(p.key)) {
        const f = planK[p.key];
        return ans({ text: f.long + " is a forecast month: " + inr(f.inflow) + " expected in and " + inr(f.outflow) + " budgeted out, so cash would move by " + inr(f.inflow - f.outflow) + ".",
          facts: [{ l: "Expected in", v: inr(f.inflow) }, { l: "Budgeted out", v: inr(f.outflow) }, { l: "Net", v: inr(f.inflow - f.outflow) }],
          table: { head: ["Item", "Amount"], align: ["l", "r"], rows: f.receipts.map((r) => ["+ " + r.name, inr(r.amount)]).concat(f.lines.map((l) => ["− " + l.name, inr(l.amount)])) },
          status: "forecast", periods: f.long, source: "Outflow Forecast sheet · AR Outstanding sheet" });
      }
      const ms = msFor(p || { kind: "fy", fy: M.curFY }), pp = p || { kind: "fy", fy: M.curFY };
      const tin = ms.reduce((s, m) => s + m.inflow, 0), tout = ms.reduce((s, m) => s + m.outflow, 0);
      const cin = ms.reduce((s, m) => s + m.clientIn, 0), oout = ms.reduce((s, m) => s + m.opOut, 0);
      const lead = which === "in" ? "Money in for " + pLabel(pp) + ": " + inr(tin) + ", of which " + inr(cin) + " came from clients."
        : which === "out" ? "Money out for " + pLabel(pp) + ": " + inr(tout) + ", of which " + inr(oout) + " was operating spend" + (tout - oout > 0.5 ? " (the rest, " + inr(tout - oout) + ", went into a fixed deposit)." : ".")
        : pLabel(pp) + ": " + inr(tin) + " came in and " + inr(tout) + " went out, a net " + (tin >= tout ? "gain" : "drop") + " of " + inr(Math.abs(tin - tout)) + ".";
      return ans({ text: lead + otherNote(p),
        facts: [{ l: "Money in", v: inr(tin) }, { l: "from clients", v: inr(cin) }, { l: "Money out", v: inr(tout) }, { l: "operating", v: inr(oout) }],
        table: ms.length > 1 ? { head: ["Month", "In", "Out", "Net"], align: ["l", "r", "r", "r"], rows: ms.map((m) => [m.long, inr(m.inflow), inr(m.outflow), inr(m.net)]).concat([["Total", inr(tin), inr(tout), inr(tin - tout)]]) }
          : { head: ["Group", "Amount"], align: ["l", "r"], rows: Object.keys(ms[0].groups).filter((g) => ms[0].groups[g]).map((g) => [M.meta.groupNames[g] + (M.D.lines.some((l) => l.group === g && l.dir === "in") ? " (in)" : " (out)"), inr(ms[0].groups[g])]) },
        periods: pLabel(pp), source: SHEET + " · rows " + M.meta.rows.inflow + " and " + M.meta.rows.outflow, w: ms.length === 1 ? "m:" + ms[0].key + ":" + (which === "out" ? "outflow" : "inflow") : null });
    }
    function topCosts(p) {
      const pp = p && p.kind !== "missing" ? p : { kind: "fy", fy: M.curFY };
      if (pp.key && isFc(pp.key)) {
        const f = planK[pp.key], ls = f.lines.slice().sort((a, b) => b.amount - a.amount);
        return ans({ text: "Biggest budget lines for " + f.long + " (forecast): " + ls.slice(0, 3).map((l) => l.name + " " + inr(l.amount, 0)).join(", ") + ".",
          table: { head: ["Budget line", "Amount", "Share"], align: ["l", "r", "r"], rows: ls.map((l) => [l.name, inr(l.amount), pct(l.amount / f.outflow)]) }, status: "forecast", periods: f.long, source: "Outflow Forecast sheet" });
      }
      const ms = msFor(pp), byG = {}, byL = {};
      ms.forEach((m) => { for (const k in m.v) { const l = M.lines[k]; if (l.dir !== "out") continue; byG[l.group] = (byG[l.group] || 0) + m.v[k]; byL[k] = (byL[k] || 0) + m.v[k]; } });
      const op = Object.keys(byG).filter((g) => g !== "investment").map((g) => ({ name: M.meta.groupNames[g], v: byG[g] })).sort((a, b) => b.v - a.v);
      const tot = op.reduce((s, g) => s + g.v, 0);
      const lines = Object.keys(byL).filter((k) => !M.lines[k].nonop).map((k) => ({ name: M.nice(M.lines[k].name), v: byL[k], row: M.lines[k].row })).sort((a, b) => b.v - a.v).slice(0, 5);
      return ans({ text: "Top operating costs for " + pLabel(pp) + ": " + op.slice(0, 3).map((g) => g.name + " " + inr(g.v, 0) + " (" + pct(g.v / tot) + ")").join(", ") + ". Biggest single line: " + lines[0].name + ", " + inr(lines[0].v, 0) + "." + otherNote(p),
        facts: [{ l: "Operating spend", v: inr(tot) }, { l: "Largest group", v: op[0].name }],
        table: { head: ["Spend group", "Amount", "Share"], align: ["l", "r", "r"], rows: op.map((g) => [g.name, inr(g.v), pct(g.v / tot)]) },
        chart: op.slice(0, 6).map((g) => ({ name: g.name, value: g.v, text: lakh(g.v), cls: "out" })),
        periods: pLabel(pp), source: SHEET + " · rows 37–88 (fixed deposit, row 35, left out)" });
    }
    function clients(p, one) {
      const pp = p && p.kind !== "missing" && !(p.key && isFc(p.key)) ? p : { kind: "fy", fy: M.curFY };
      const ms = msFor(pp), by = {};
      ms.forEach((m) => { for (const k in m.v) if (M.lines[k].client) by[k] = (by[k] || 0) + m.v[k]; });
      const list = Object.keys(by).filter((k) => by[k]).map((k) => ({ id: k, name: M.nice(M.lines[k].name), short: M.short(M.lines[k].name), v: by[k], row: M.lines[k].row })).sort((a, b) => b.v - a.v);
      const tot = list.reduce((s, c) => s + c.v, 0);
      if (one) {
        const c = list.find((x) => x.id === one.id), months = ms.filter((m) => m.v[one.id]);
        if (!c) return ans({ text: one.short + " paid nothing in " + pLabel(pp) + ". Across all " + M.months.length + " months they paid " + inr(M.months.reduce((s, m) => s + (m.v[one.id] || 0), 0)) + ".", periods: pLabel(pp), source: SHEET + " · row " + one.row, suggest: ["How much did " + one.short + " pay in total?"] });
        return ans({ text: c.short + " paid " + inr(c.v) + " in " + pLabel(pp) + ", " + pct(c.v / tot) + " of all client receipts, across " + months.length + " month" + (months.length === 1 ? "" : "s") + ".",
          facts: [{ l: "Paid", v: inr(c.v) }, { l: "Share of client money", v: pct(c.v / tot, 1) }, { l: "Rank", v: (list.indexOf(c) + 1) + " of " + list.length }],
          table: { head: ["Month", "Received"], align: ["l", "r"], rows: months.map((m) => [m.long, inr(m.v[one.id])]) }, periods: pLabel(pp), source: SHEET + " · row " + c.row });
      }
      return ans({ text: list.length + " clients paid " + inr(tot) + " in " + pLabel(pp) + ". The largest: " + list.slice(0, 3).map((c) => c.short + " " + inr(c.v, 0)).join(", ") + "." + (p && p.key && isFc(p.key) ? " (Client receipts are actual only; for the forecast, ask about the plan.)" : ""),
        facts: [{ l: "Client receipts", v: inr(tot) }, { l: "Clients", v: String(list.length) }, { l: "Top client share", v: list[0] ? pct(list[0].v / tot) : "–" }],
        table: { head: ["Client", "Received", "Share"], align: ["l", "r", "r"], rows: list.map((c) => [c.name, inr(c.v), pct(c.v / tot)]) },
        chart: list.slice(0, 6).map((c) => ({ name: c.short, value: c.v, text: lakh(c.v) })),
        periods: pLabel(pp), source: SHEET + " · rows 12–26 (loans, fixed deposit and tax refund left out)" });
    }
    function runway() {
      const r = M.runway;
      return ans({ text: "If nothing came in and spending kept the last six months' pace, cash of " + inr(M.last.close, 0) + " would last about " + Math.floor(r.days) + " days, or " + r.sprints.toFixed(1) + " T-Sprints (a T-Sprint is 15 days).",
        facts: [{ l: "Cash", v: inr(M.last.close) }, { l: "Spend per day", v: inr(r.daily) }, { l: "Runway", v: Math.floor(r.days) + " days" }, { l: "In T-Sprints", v: r.sprints.toFixed(2) }],
        table: { head: ["Step", "Value"], align: ["l", "r"], rows: r.working.steps.map((s) => [s.label, s.value]) },
        periods: M.months[M.months.length - 6].long + " – " + M.last.long, source: SHEET + " · rows " + M.meta.rows.outflow + " and " + M.meta.rows.close, w: "runway" });
    }
    function changed() {
      const a = M.last, b = M.prevM, ch = M.changes.slice(0, 8);
      return ans({ text: a.long + " vs " + b.long + ": money in " + (a.inflow >= b.inflow ? "rose" : "fell") + " by " + inr(Math.abs(a.inflow - b.inflow), 0) + ", money out " + (a.outflow >= b.outflow ? "rose" : "fell") + " by " + inr(Math.abs(a.outflow - b.outflow), 0) + ", and cash closed " + inr(Math.abs(a.close - b.close), 0) + (a.close >= b.close ? " higher." : " lower."),
        facts: [{ l: "In", v: inr(a.inflow - b.inflow, 0) }, { l: "Out", v: inr(a.outflow - b.outflow, 0) }, { l: "Closing", v: inr(a.close - b.close, 0) }],
        table: { head: ["Line", b.short, a.short, "Change"], align: ["l", "r", "r", "r"], rows: ch.map((c) => [c.name + (c.dir === "in" ? " (in)" : " (out)"), inr(c.before, 0), inr(c.now, 0), (c.diff > 0 ? "+" : "") + inr(c.diff, 0)]) },
        periods: b.long + " → " + a.long, source: SHEET + " · columns " + (b.sheet ? b.sheet.col : "") + " and " + (a.sheet ? a.sheet.col : "") });
    }
    function plan(p) {
      if (p && p.key && isFc(p.key)) return closing(p);
      const P = M.plan.months;
      return ans({ text: "The plan covers " + P.map((f) => f.long).join(" and ") + ". Cash would go from " + inr(M.last.close, 0) + " to " + P.map((f) => inr(f.close, 0)).join(" and then ") + ". " + M.verdict.sub,
        facts: P.map((f) => ({ l: f.short + " close (forecast)", v: inr(f.close) })),
        table: { head: ["Month", "Opening", "In", "Out", "Closing"], align: ["l", "r", "r", "r", "r"], rows: P.map((f) => [f.long, inr(f.open), inr(f.inflow), inr(f.outflow), inr(f.close)]) },
        status: "forecast", periods: P.map((f) => f.long).join(", "), source: "Outflow Forecast sheet · AR Outstanding sheet", w: "fc:" + P[P.length - 1].key });
    }
    function owed() {
      const A = M.arItems, tot = A.reduce((s, a) => s + a.amount, 0);
      return ans({ text: A.length + " invoices are open for " + inr(tot) + ": " + A.map((a) => a.short + " " + inr(a.amount, 0) + " (" + a.daysOverdue + " days)").join(", ") + ". The sheet expects both on " + M.dateLabel(A[0].expected) + ", a date it sets 30 days after the file was opened, so treat it as an assumption.",
        facts: [{ l: "Open invoices", v: String(A.length) }, { l: "Total owed", v: inr(tot) }, { l: "Bad debts written off", v: inr((M.D.badDebts || []).reduce((s, b) => s + b.amount, 0)) }],
        table: { head: ["Client", "Invoice", "Amount", "Days", "Status"], align: ["l", "l", "r", "r", "l"], rows: A.map((a) => [a.name, a.invoice, inr(a.amount), String(a.daysOverdue), a.status]) },
        periods: "As saved " + M.meta.saved.slice(0, 10), source: "AR Outstanding sheet · rows " + A.map((a) => a.row).join(", ") });
    }
    function advances() {
      const A = M.D.advances, bal = A.reduce((s, a) => s + a.balance, 0), ses = A.reduce((s, a) => s + a.sessionsLeft, 0);
      return ans({ text: "Clients have paid advances for work still to come: " + inr(bal) + " across " + ses + " sessions. That cash is already in the bank; the team still owes the time.",
        facts: [{ l: "Still to deliver", v: inr(bal) }, { l: "Sessions owed", v: String(ses) }],
        table: { head: ["Client", "Sessions left", "Balance"], align: ["l", "r", "r"], rows: A.map((a) => [M.nice(a.client), String(a.sessionsLeft), inr(a.balance)]) },
        periods: "As saved " + M.meta.saved.slice(0, 10), source: "Advances Summary sheet", w: "watch:advances" });
    }
    function salaries(p) {
      const pp = p && p.kind !== "missing" ? p : { kind: "fy", fy: M.curFY };
      if (pp.key && isFc(pp.key)) { const f = planK[pp.key], s = f.lines.filter((l) => /salar/i.test(l.name)); const t = s.reduce((a, l) => a + l.amount, 0); return ans({ text: "Budgeted salaries for " + f.long + ": " + inr(t) + " (forecast; directors' salaries are not in the budget, per the sheet).", facts: [{ l: "Salaries budget", v: inr(t) }, { l: "Cash now", v: inr(M.last.close) }], status: "forecast", periods: f.long, source: "Outflow Forecast · row " + (s[0] ? s[0].row : "") }); }
      const ms = msFor(pp), t = ms.reduce((s, m) => s + (m.groups.salaries || 0), 0);
      return ans({ text: "Salaries and consultants for " + pLabel(pp) + ": " + inr(t) + (ms.length > 1 ? ", about " + inr(t / ms.length, 0) + " a month." : ".") + " The safety line is one month of payroll: " + inr(M.safety.value, 0) + "." + otherNote(p),
        facts: [{ l: "Salaries", v: inr(t) }, { l: "Safety line", v: inr(M.safety.value) }],
        table: { head: ["Month", "Salaries"], align: ["l", "r"], rows: ms.map((m) => [m.long, inr(m.groups.salaries || 0)]) },
        periods: pLabel(pp), source: SHEET + " · rows 37–54", w: "safety" });
    }
    function budgetVs(p) {
      const keys = M.months.filter((m) => M.budget.months.includes(m.key)).map((m) => m.key);
      const k = p && p.key && keys.includes(p.key) ? [p.key] : keys;
      const rows = k.map((key) => { const m = M.MK[key], b = M.budget.lines.reduce((s, l) => s + (l.v[key] || 0), 0); return [m.long, inr(b, 0), inr(m.opOut, 0), (m.opOut - b >= 0 ? "+" : "") + inr(m.opOut - b, 0)]; });
      const tb = k.reduce((s, key) => s + M.budget.lines.reduce((a, l) => a + (l.v[key] || 0), 0), 0), ta = k.reduce((s, key) => s + M.MK[key].opOut, 0);
      return ans({ text: (k.length === 1 ? M.MK[k[0]].long : M.MK[k[0]].long + " – " + M.MK[k[k.length - 1]].long) + ": operating spend " + inr(ta, 0) + " against a budget of " + inr(tb, 0) + ", " + (ta >= tb ? pct(ta / tb - 1) + " over." : pct(1 - ta / tb) + " under."),
        facts: [{ l: "Budget", v: inr(tb) }, { l: "Actual", v: inr(ta) }, { l: "Difference", v: inr(ta - tb) }],
        table: { head: ["Month", "Budget", "Actual", "Over / under"], align: ["l", "r", "r", "r"], rows },
        periods: k.length === 1 ? M.MK[k[0]].long : M.MK[k[0]].long + " – " + M.MK[k[k.length - 1]].long, source: "Outflow Forecast sheet (full lines) vs " + SHEET + " row " + M.meta.rows.outflow + " less the fixed deposit" });
    }
    function books() {
      const C = M.checks, ok = C.filter((c) => c.ok).length;
      return ans({ text: ok === C.length ? "Yes. All " + C.length + " checks pass: every week and month balances, totals match the HDFC statement to the paisa, and the forecast adds up." : ok + " of " + C.length + " checks pass. See the Test tab.",
        table: { head: ["Check", "Result"], align: ["l", "l"], rows: C.map((c) => [c.name, (c.ok ? "Pass · " : "FAIL · ") + c.detail]) }, periods: "All " + M.months.length + " months", source: "Re-run in your browser from the workbook data" });
    }
    function extremes(q) {
      const lo = M.months.reduce((a, b) => (b.close < a.close ? b : a)), hi = M.months.reduce((a, b) => (b.close > a.close ? b : a));
      const want = /low|worst|min|least|bottom/.test(q) ? "low" : "high";
      const m = want === "low" ? lo : hi;
      return ans({ text: "The " + (want === "low" ? "lowest" : "highest") + " month-end cash was " + inr(m.close) + " in " + m.long + ". The " + (want === "low" ? "highest" : "lowest") + " was " + inr((want === "low" ? hi : lo).close) + " in " + (want === "low" ? hi : lo).long + ".",
        facts: [{ l: "Lowest", v: inr(lo.close) + " · " + lo.short }, { l: "Highest", v: inr(hi.close) + " · " + hi.short }],
        table: { head: ["Month", "Closing"], align: ["l", "r"], rows: M.months.slice().sort((a, b) => (want === "low" ? a.close - b.close : b.close - a.close)).slice(0, 5).map((x) => [x.long, inr(x.close)]) },
        periods: "All " + M.months.length + " actual months", source: SHEET + " · row " + M.meta.rows.close, w: "m:" + m.key + ":close" });
    }
    function other(p) {
      const pp = p && p.kind !== "missing" && !(p.key && isFc(p.key)) ? p : { kind: "fy", fy: M.curFY };
      const ms = msFor(pp), by = {};
      ms.forEach((m) => { for (const k in m.v) { const l = M.lines[k]; if ((l.dir === "in" && !l.client) || l.nonop) by[k] = (by[k] || 0) + m.v[k]; } });
      const rows = Object.keys(by).filter((k) => by[k]).map((k) => [M.nice(M.lines[k].name) + (M.lines[k].dir === "in" ? " (in)" : " (out)"), inr(by[k])]);
      return ans({ text: "Money that is not client work or running costs, " + pLabel(pp) + ": " + (rows.length ? rows.map((r) => r[0] + " " + r[1]).join(", ") + "." : "none."), table: rows.length ? { head: ["Line", "Amount"], align: ["l", "r"], rows } : null, periods: pLabel(pp), source: SHEET + " · rows 27–35" });
    }
    function safetyA() {
      return ans({ text: "The safety line is one month of payroll: " + inr(M.safety.value) + ", the average of salaries over " + M.months[M.months.length - 6].long + " – " + M.last.long + ". Cash is " + (M.last.close >= M.safety.value ? "above" : "below") + " it now (" + inr(M.last.close, 0) + ").",
        facts: [{ l: "Safety line", v: inr(M.safety.value) }, { l: "Cash now", v: inr(M.last.close) }],
        table: { head: ["Month", "Salaries"], align: ["l", "r"], rows: M.safety.working.steps.map((s) => [s.label.replace("Salaries & consultants, ", ""), s.value]) },
        periods: M.months[M.months.length - 6].long + " – " + M.last.long, source: SHEET + " · rows 37–54", w: "safety" });
    }

    /* ---------- routing ---------- */
    function findClient(q) {
      const words = q.split(" ");
      return clientList.find((c) => { const sh = c.short.toLowerCase(); if (/^other/.test(sh)) return false; if (sh.length <= 4 ? words.includes(sh) : q.includes(sh)) return true; return c.name.toLowerCase().split(/\s+/).some((w) => w.length >= 5 && !/^(private|limited|foundation|association|international|national|network|global|school|business|research|education|centres|technologies|solutions|educational|incubator|incubation|university|realty|other|others|clients|client|limited)$/.test(w) && words.includes(w)); });
    }
    function answer(raw) {
      const q = norm(raw);
      if (!q) return ans({ text: "Type a question, or pick one below.", suggest: suggestions.slice(0, 4), status: "none" });
      const p = period(q);
      if (p && p.kind === "missing") return ans({ text: "There is no " + p.text.trim() + " in the workbook. Actual figures run " + M.months[0].long + " – " + M.last.long + "; the plan covers " + M.plan.months.map((f) => f.long).join(" and ") + ".", suggest: ["What is the cash balance now?", "What does the plan say for December?"], status: "none" });
      const client = findClient(q);
      let a = null;
      if (has(q, /\b(books?|reconcil|balance check|checks?|add up|tally|match(es)? the bank)\b/) && !has(q, /\bcash balance\b/)) a = books();
      else if (has(q, /\brunway\b|how long|last (us|till|until)|run out|t-?sprints?\b|months? left|days? left|survive/)) a = (has(q, /\bplan|forecast\b/) ? plan(p) : runway());
      else if (has(q, /\b(owe|owed|owing|receivable|ar\b|outstanding|overdue|unpaid|pending invoice|invoices?|collect)/)) a = owed();
      else if (has(q, /\badvance/)) a = advances();
      else if (client && has(q, /\b(pay|paid|receiv|got|bring|brought|from|much|contribut|share)/)) a = clients(p, client);
      else if (client) a = clients(p, client);
      else if (has(q, /\b(change|changed|differ|compare|compared|vs|versus|movement)\b/) && !has(q, /\bbudget\b/)) a = changed();
      else if (has(q, /\bbudget|over ?spend|overspent|plan vs actual|against plan\b/)) a = budgetVs(p);
      else if (has(q, /\b(plan|forecast|projection|project|expect|next month|going forward|coming months|future)\b/) || (p && p.key && isFc(p.key) && !has(q, /\b(cost|expense|spend|salar)/))) a = plan(p);
      else if (has(q, /\bsafety\b|cushion|buffer|reserve/)) a = safetyA();
      else if (has(q, /\b(lowest|highest|best|worst|peak|minimum|maximum|bottom|top month)\b/) && !has(q, /\b(cost|expense|client|spend)/)) a = extremes(q);
      else if (has(q, /\bsalar|payroll|wages|consultant/)) a = salaries(p);
      else if (has(q, /\b(top|biggest|largest|main|major|highest)\b.*\b(cost|expense|spend|outflow|line)|\b(cost|expense)s?\b.*\b(top|biggest|largest)|where did (the )?money go|what did we spend on|spent on|break ?down of (spend|cost)/)) a = topCosts(p);
      else if (has(q, /\b(client|customer)s?\b|who paid|which clients|top clients|biggest client|receipts from/)) a = clients(p);
      else if (has(q, /\b(loan|fixed deposit|\bfd\b|refund|itr|other income|non-?client)/)) a = other(p);
      else if (has(q, /\b(cash|balance|bank|closing|close|closed|in hand|position|money do we have|how much do we have)\b/) && !has(q, /\b(came in|went out|inflow|outflow|spend|spent)\b/)) a = closing(p);
      else if (has(q, /\b(in and out|in & out|inflows? and outflows?|came in and went out|net|cash ?flow)\b/)) a = flows(p, "both");
      else if (has(q, /\b(inflow|came in|money in|received|receipts|income|earn|collected|revenue)\b/)) a = flows(p, "in");
      else if (has(q, /\b(outflow|went out|money out|spent|spend|spending|expenses?|costs?|paid out|burn)\b/)) a = has(q, /\bwhat|which|where|top|biggest|on\b/) && !has(q, /how much/) ? topCosts(p) : flows(p, "out");
      if (a) { if (!a.suggest.length) a.suggest = nextFor(a); return a; }
      return ans({ text: "I didn't understand that one. I can answer questions about cash, money in and out, costs, clients, runway, the plan, what's owed and whether the books balance. These are the closest:", suggest: closest(q), status: "none" });
    }
    function nextFor(a) {
      const pool = suggestions.filter((s) => norm(s) !== norm(a.asked || ""));
      const i = Math.abs(String(a.text).length) % pool.length;
      return [pool[i], pool[(i + 3) % pool.length], pool[(i + 6) % pool.length]];
    }
    function closest(q) {
      const qw = new Set(q.split(" ").filter((w) => w.length > 2));
      return suggestions.map((s) => ({ s, score: norm(s).split(" ").filter((w) => qw.has(w)).length })).sort((a, b) => b.score - a.score).slice(0, 4).map((x) => x.s);
    }
    return { answer, suggestions };
  }
  root.TSAsk = { create };
})(typeof window !== "undefined" ? window : globalThis);
