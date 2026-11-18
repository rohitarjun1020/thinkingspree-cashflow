/* Thinking Spree · Cash — renders the six T-Sprint stages from TSModel, plus the passcode gate, Show working,
   month hover sync, Replay, What-if and the built-in chat. Data: dashboard-data.js (tools/refresh.py). */
(function () {
  "use strict";
  /* Passcode: SHA-256 of the placeholder passcode. To change it, see MONTHLY-UPDATE.md.
     On a public site this keeps casual visitors out; it is not real security. */
  const PASS_HASH = "460a73f2de33f9ddbd105696fbe61e3c89b5f4042b92635116de627955ae7754";
  const OK_KEY = "ts.ok";
  /* Ask Claude: the private claude.ai page fed with the same figures (empty = button hidden). */
  const ASK_CLAUDE_URL = "https://claude.ai/artifact/S3ibYFXMgg3uDGa8F2BLAb";

  const D = window.TS_DATA, M = window.TSModel.create(D), C = window.TSCharts, A = window.TSAsk.create(M);
  const { inr, lakh, pct } = M;
  const $ = (id) => document.getElementById(id);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const planK = {}; M.plan.months.forEach((f) => (planK[f.key] = f));
  const MINUS = "−";

  /* ---------- tiny DOM helpers (text only via textContent) ---------- */
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k === "text") e.textContent = v; else if (k === "cls") e.className = v; else if (k.startsWith("data")) e.setAttribute(k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()), v); else e.setAttribute(k, v === true ? "" : v); }
    (kids || []).forEach((c) => c != null && e.append(c));
    return e;
  }
  const dot = (cls, style) => h("span", { cls: "dot " + (cls || ""), style, "aria-hidden": "true" });
  const tag = (fc) => h("span", { cls: "tag" + (fc ? " fc" : "") }, [dot(fc ? "ring" : ""), fc ? "Forecast" : "Actual"]);
  const wbtn = (text, w, cls, label) => h("button", { type: "button", cls: "w " + (cls || ""), "data-w": w, "aria-label": label || null, text });
  const tickFmt = (v) => (v === 0 ? "₹0" : lakh(v, Math.abs(v) % 1e5 === 0 ? 0 : 1));
  function table(head, rows, align, opts) {
    opts = opts || {};
    const t = h("table", {}, [h("thead", {}, [h("tr", {}, head.map((x, i) => h("th", { cls: align && align[i] === "r" ? "r" : null, scope: "col", text: x })))])]);
    const tb = h("tbody");
    rows.forEach((r, ri) => {
      const meta = opts.meta ? opts.meta[ri] || {} : {};
      tb.append(h("tr", { cls: meta.cls || null, "data-month": meta.key || null }, r.map((c, i) => h("td", { cls: align && align[i] === "r" ? "r" : null }, [c instanceof Node ? c : String(c)]))));
    });
    t.append(tb);
    if (opts.caption) t.prepend(h("caption", { cls: "sr", text: opts.caption }));
    return h("div", { cls: "tbl-wrap" }, [t]);
  }

  /* ---------- Show working ---------- */
  function workFor(id) {
    const p = id.split(":");
    if (p[0] === "m") return M.monthWork(M.MK[p[1]], p[2]);
    if (p[0] === "fc") return M.fcWork(planK[p[1]]);
    if (p[0] === "wi") { const f = wiState.result.months.find((x) => x.key === p[1]); return M.fcWork(f); }
    if (p[0] === "sc") { const sc = M.scenarios.find((s) => s.id === p[1]); const f = sc.f.months[sc.f.months.length - 1]; const w = M.fcWork(f); w.title = sc.name + " · " + w.title; w.note = sc.note + " " + w.note; return w; }
    if (p[0] === "runway") return M.runway.working;
    if (p[0] === "safety") return M.safety.working;
    if (p[0] === "verdict") return M.verdict.working;
    if (p[0] === "watch") return M.watch.find((x) => x.id === p[1]).working;
    if (p[0] === "fy") { const T = fyT(p[2]); return T.work(p[1], { inflow: "Money in", outflow: "Money out", clientIn: "Client receipts", opOut: "Operating spend" }[p[1]]); }
    if (p[0] === "client" || p[0] === "group") return groupWork(p[0], p[1], p[2]);
    if (p[0] === "budget") return budgetWork(p[1]);
    if (p[0] === "week") { const w = M.weeks[+p[1]]; return M.work("Week " + w.label + " · closing", inr(w.close), "actual", [{ label: "Opening", value: inr(w.open), src: M.cellRef(M.meta.rows.open, w.col) }, { label: "+ Money in", value: inr(w.inflow), src: M.cellRef(M.meta.rows.inflow, w.col) }, { label: MINUS + " Money out", value: inr(w.outflow), src: M.cellRef(M.meta.rows.outflow, w.col) }, { label: "= Closing", value: inr(w.close), src: "Opening + in − out" }], w.sheet && Math.abs(w.sheet.close - w.close) > 0.005 ? "The sheet shows " + inr(w.sheet.close) + " for this week because its weekly opening cell is blank; the dashboard carries the previous week's close forward." : "", "Opening + in − out"); }
    return null;
  }
  function fyT(sel) { return sel === "all" ? allT : sel === "prev" ? M.FYprev : M.FY; }
  function groupWork(kind, id, sel) {
    const T = fyT(sel), ms = T.months;
    const ids = kind === "client" ? [id] : M.D.lines.filter((l) => l.group === id).map((l) => l.id);
    const name = kind === "client" ? M.nice(M.lines[id].name) : M.meta.groupNames[id];
    const steps = ms.map((m) => ({ label: m.long, value: inr(ids.reduce((s, k) => s + (m.v[k] || 0), 0)), src: kind === "client" ? M.cellRef(M.lines[id].row, m.sheet ? m.sheet.col : "") : M.cellRef(M.meta.groupRows[id], m.sheet ? m.sheet.col : "") + " (rows " + M.lines[ids[0]].row + "–" + M.lines[ids[ids.length - 1]].row + ")" })).filter((s) => s.value !== inr(0));
    const tot = ms.reduce((s, m) => s + ids.reduce((a, k) => a + (m.v[k] || 0), 0), 0);
    steps.push({ label: "Total, " + T.name, value: inr(tot), src: "" });
    return M.work(name + " · " + T.name, inr(tot), "actual", steps, kind === "client" ? "Share of client receipts: " + pct(tot / T.clientIn, 1) + "." : "", "Sum of months");
  }
  function budgetWork(key) {
    const m = M.MK[key], b = M.budget.lines.filter((l) => l.v[key]);
    const tb = b.reduce((s, l) => s + l.v[key], 0);
    const steps = b.map((l) => ({ label: l.name, value: inr(l.v[key]), src: "Outflow Forecast · row " + l.row })).concat([{ label: "Budget (sum of lines)", value: inr(tb), src: "" }]);
    if (m) steps.push({ label: "Actual operating spend", value: inr(m.opOut), src: M.cellRef(M.meta.rows.outflow, m.sheet ? m.sheet.col : "") + " less fixed deposit" }, { label: "Over (+) / under (−) budget", value: inr(m.opOut - tb), src: "" });
    return M.work("Budget " + (m ? "vs actual" : "(forecast)") + " · " + M.monthLabel(key, true), inr(m ? m.opOut - tb : tb), m ? "actual" : "forecast", steps, "The budget uses every line on the Outflow Forecast sheet, including GST and TDS, which the sheet's own Total row leaves out.", m ? "Actual − budget" : "Sum of budget lines");
  }
  let workOpener = null;
  function openWork(id, opener) {
    const w = workFor(id); if (!w) return;
    const fc = w.status === "forecast";
    $("workStatus").replaceChildren(dot(fc ? "ring" : ""), fc ? "Forecast" : "Actual", " · Show working");
    $("workTitle").textContent = w.title; $("workValue").textContent = w.value; $("workFormula").textContent = w.formula ? "Worked out as: " + w.formula : "";
    $("workSteps").replaceChildren(...w.steps.map((s) => h("li", {}, [h("span", { text: s.label }), h("span", { cls: "v", text: s.value }), s.src ? h("span", { cls: "s", text: s.src }) : null])));
    $("workNote").textContent = w.note || "";
    $("work").hidden = false; workOpener = opener || document.activeElement; $("workClose").focus();
  }
  function closeWork() { $("work").hidden = true; if (workOpener && workOpener.focus) workOpener.focus(); }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-w]"); if (b) { e.preventDefault(); openWork(b.dataset.w, b); return; }
    const g = e.target.closest("[data-go]"); if (g) { location.hash = g.dataset.go; return; }
    const t = e.target.closest("[data-table]"); if (t) { const box = $("tbl-" + t.dataset.table); box.hidden = !box.hidden; t.setAttribute("aria-expanded", String(!box.hidden)); t.textContent = box.hidden ? "Table" : "Hide table"; }
  });
  $("workClose").addEventListener("click", closeWork);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("work").hidden) closeWork(); });

  /* ---------- month hover sync + tooltip ---------- */
  let hlKey = null;
  function hl(key) {
    if (key === hlKey) return; hlKey = key;
    document.querySelectorAll(".hl").forEach((n) => n.classList.remove("hl"));
    if (key) document.querySelectorAll('[data-month="' + key + '"]').forEach((n) => n.classList.add("hl"));
  }
  const tip = $("tip");
  function showTip(e, title, rows, fc) {
    tip.replaceChildren(h("div", { cls: "h" }, [h("span", { text: title }), fc != null ? tag(fc) : null]), ...rows.map((r) => h("div", { cls: "r" }, [r.dot ? dot(r.dot, r.style) : h("span", { cls: "k", style: "border-color:" + (r.color || "var(--ink)") + (r.dash ? ";border-top-style:dashed" : "") }), h("span", { text: r.label }), h("b", { text: r.value })])));
    tip.hidden = false;
    const W = innerWidth, x = e.clientX, y = e.clientY, tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(W - tw - 8, x + 14)) + "px";
    tip.style.top = Math.max(8, y - th - 12 < 8 ? y + 18 : y - th - 12) + "px";
  }
  const hideTip = () => { tip.hidden = true; };
  const leave = () => { hl(null); hideTip(); };
  document.addEventListener("pointerover", (e) => { const m = e.target.closest(".margin [data-month], tr[data-month]"); if (m) hl(m.dataset.month); });
  document.addEventListener("focusin", (e) => { const m = e.target.closest("[data-month]"); if (m) hl(m.dataset.month); });
  document.addEventListener("scroll", hideTip, { passive: true });

  /* ================= MAP ================= */
  const last = M.last;
  function renderShell() {
    $("asof").textContent = "Actuals to " + M.dateLabel(M.meta.actualTo) + " · file saved " + M.dateLabel(M.meta.saved.slice(0, 10)) + " · plan to " + M.monthLabel(M.horizonEnd, true);
    const ok = M.checks.filter((c) => c.ok).length, all = M.checks.length;
    const b = $("booksBadge"); b.classList.toggle("bad", ok !== all);
    const wk = M.checks.find((c) => c.id === "week-identity");
    b.replaceChildren(dot(), ok === all ? "Books balance · " + (wk ? wk.detail : all + " checks") : ok + " of " + all + " checks pass");
    b.setAttribute("aria-label", (ok === all ? "Books balance: all " + all + " checks pass." : ok + " of " + all + " checks pass.") + " Open the checks.");
    b.title = ok + " of " + all + " checks pass";
    $("foot").replaceChildren(h("span", { text: "Built from " + M.meta.source + ", saved " + M.meta.saved + " by " + M.meta.savedBy.replace(/\s+/g, " ") }), h("span", { text: "Click any underlined figure to see its working and workbook cell." }), h("span", { text: "Refreshed " + M.meta.generated }));
  }
  function renderMap() {
    const v = M.verdict;
    $("vHead").textContent = v.head + " "; $("vTail").textContent = v.tail;
    $("h-map").className = "verdict " + v.tone;
    $("vSub").replaceChildren(v.sub + " ", wbtn("Show working", "verdict"));
    const r = M.runway, fy = M.FY;
    const fig = (label, value, w, cls, fc, aria) => h("div", { cls: "fig " + (cls || "") }, [wbtn(value, w, "v", aria), h("span", { cls: "l" }, [tag(fc), label])]);
    $("figs").replaceChildren(
      fig("Cash at " + M.dateLabel(M.meta.actualTo), inr(last.close), "m:" + last.key + ":close", "lead-fig", false, "Cash at " + M.dateLabel(M.meta.actualTo) + ": " + inr(last.close) + ". Show working."),
      fig("Runway if nothing comes in: " + r.sprints.toFixed(1) + " T-Sprints", Math.floor(r.days) + " days", "runway", "", false, "Runway if nothing comes in: " + Math.floor(r.days) + " days, " + r.sprints.toFixed(1) + " T-Sprints. Show working."),
      fig("Client money in, " + fy.name, inr(fy.clientIn, 0), "fy:clientIn:cur"),
      fig("Operating spend, " + fy.name, inr(fy.opOut, 0), "fy:opOut:cur"),
      fig("Safety line: one month of payroll", inr(M.safety.value, 0), "safety"));
    $("cashKey").replaceChildren(h("span", {}, [dot("in"), "Actual, above the safety line"]), h("span", {}, [dot("warn"), "below it"]), h("span", {}, [dot("crit"), "below ₹0"]), h("span", {}, [dot("fc"), "Plan (forecast)"]), h("span", {}, [h("i", { cls: "ln safe" }), "Safety line"]));
    renderMargin(null);
    $("tbl-cash").replaceChildren(table(["Month", "Opening", "Money in", "Money out", "Closing", "Status"],
      M.months.map((m) => [m.long, inr(m.open), inr(m.inflow), inr(m.outflow), inr(m.close), "Actual"]).concat(M.plan.months.map((f) => [f.long, inr(f.open), inr(f.inflow), inr(f.outflow), inr(f.close), "Forecast"])),
      ["l", "r", "r", "r", "r", "l"], { meta: M.months.map((m) => ({ key: m.key })).concat(M.plan.months.map((f) => ({ key: f.key, cls: "fc" }))), caption: "Cash at each month-end" }));
    /* watch list */
    const sev = (n) => (n >= 3 ? "crit" : n === 2 ? "warn" : "slate"), sevVar = (n) => (n >= 3 ? "crit" : n === 2 ? "warn" : "note");
    $("watchKey").replaceChildren(h("span", {}, [h("span", { cls: "dots" }, [dot("crit"), dot("crit"), dot("crit")]), "most urgent"]), h("span", {}, [h("span", { cls: "dots" }, [dot("warn"), dot("warn")]), "watch closely"]), h("span", {}, [dot("slate"), "keep an eye"]), h("span", {}, [dot("ring", "border-color:var(--ink-2)"), "forecast"]));
    $("watch").replaceChildren(...M.watch.map((it) => {
      const col = "var(--" + sevVar(it.dots) + ")";
      const dots = h("span", { cls: "dots", "aria-label": it.dots + " of 3 dots, " + (it.forecast ? "forecast" : "actual") }, Array.from({ length: it.dots }, () => it.forecast ? dot("ring", "border-color:" + col) : dot(sev(it.dots))));
      return h("li", {}, [h("button", { type: "button", cls: "note-i" + (it.changed ? " lit" : ""), "data-w": "watch:" + it.id, style: "width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer" }, [
        h("span", { cls: "note-top" }, [dots, h("span", { cls: "a", text: it.amount })]),
        h("span", { cls: "t", text: it.title }), h("span", { cls: "n", text: it.note }),
        h("span", { cls: "note-top" }, [tag(it.forecast), it.changed ? h("span", { cls: "tag new", text: "New since last file" }) : null])])]);
    }));
    /* month card */
    $("h-month").textContent = last.long + " at a glance";
    const mc = (l, f) => h("div", {}, [wbtn(inr(last[f], 0), "m:" + last.key + ":" + f, "v", l + ", " + last.long + ": " + inr(last[f]) + ". Show working."), h("span", { cls: "l", text: l })]);
    const topOut = Object.keys(last.v).filter((k) => M.lines[k].dir === "out").map((k) => ({ n: M.nice(M.lines[k].name), v: last.v[k] })).sort((a, b) => b.v - a.v).slice(0, 4);
    $("monthCard").replaceChildren(h("div", { cls: "mcard" }, [mc("Opening", "open"), mc("Money in", "inflow"), mc("Money out", "outflow"), mc("Closing", "close")]),
      h("div", { cls: "split" }, [
        h("div", { cls: "split-row" }, [h("span", { text: "Client receipts" }), h("b", { cls: "num", text: inr(last.clientIn, 0) })]),
        h("div", { cls: "split-row" }, [h("span", { text: "Other money in (loans, refunds, FD back)" }), h("b", { cls: "num", text: inr(last.otherIn, 0) })]),
        ...topOut.map((t) => h("div", { cls: "split-row" }, [h("span", { text: "Out: " + t.n }), h("b", { cls: "num", text: inr(t.v, 0) })]))]));
    /* what changed */
    $("h-changes").textContent = "What changed from " + M.prevM.long.split(" ")[0];
    $("changes").replaceChildren(...M.changes.slice(0, 8).map((c) => h("li", {}, [dot(c.dir === "in" ? "in" : "out"), h("span", { text: c.name + (c.dir === "in" ? " (in)" : " (out)") }), h("span", { cls: "was num", text: inr(c.before, 0) + " → " + inr(c.now, 0) }), h("b", { cls: "d num", text: (c.diff > 0 ? "+" : "") + inr(c.diff, 0) })])));
  }
  const sevColor = (p) => (p.value < 0 ? "var(--crit)" : p.value < M.safety.value ? "var(--warn)" : "var(--good)");
  const sevCls = (v) => (v < 0 ? "crit" : v < M.safety.value ? "warn" : "in");
  const cashPts = () => M.months.map((m) => ({ key: m.key, label: m.short, value: m.close, fc: false, m })).concat(M.plan.months.map((f) => ({ key: f.key, label: f.short, value: f.close, fc: true, m: f })));
  function marginKeys() { return M.months.slice(-6).map((m) => m.key).concat(M.plan.months.map((f) => f.key)); }
  function renderMargin(curKey) {
    $("cashMargin").replaceChildren(...marginKeys().map((k) => {
      const m = M.MK[k] || planK[k], fc = !M.MK[k];
      return h("li", { cls: [fc ? "fc" : "", m.close < 0 ? "neg" : "", k === (curKey || last.key) ? "cur" : "", M.changedKeys.includes(k) ? "lit" : ""].join(" "), "data-month": k, title: M.changedKeys.includes(k) ? "New or changed since the last file" : null }, [
        h("span", { cls: "m" }, [fc ? dot("ring") : dot(sevCls(m.close)), " " + m.short]),
        wbtn(inr(m.close, 0), fc ? "fc:" + k : "m:" + k + ":close", "v", m.long + " closing " + (fc ? "(forecast)" : "(actual)") + ": " + inr(m.close) + ". Show working.")]);
    }));
  }
  function drawCash(upto, draw) {
    const P = cashPts(), n = P.length, lastA = M.months.length - 1;
    C.cash($("cashChart"), { points: P, upto, draw, safety: M.safety.value, fmt: tickFmt, dotColor: sevColor,
      labels: [{ i: lastA, text: lakh(last.close) }, { i: n - 1, text: lakh(P[n - 1].value) }],
      onHover: (k, e, p) => { hl(k); showTip(e, p.m.long, [{ dot: p.fc ? "ring" : sevCls(p.value), label: "Closing", value: inr(p.value) }, { label: "In", value: inr(p.m.inflow), color: "var(--in)" }, { label: "Out", value: inr(p.m.outflow), color: "var(--out)" }], p.fc); }, onLeave: leave });
    $("cashChart").setAttribute("aria-label", "Line chart of cash at each month-end from " + M.months[0].long + " to " + last.long + " (actual), then " + M.plan.months.map((f) => f.long).join(" and ") + " (plan). Lowest " + inr(Math.min(...M.months.map((m) => m.close))) + "; " + last.long + " " + inr(last.close) + "; plan ends at " + inr(M.plan.end) + ". Exact figures are in the list beside it and in the table.");
  }
  /* Replay: step month by month; each still frame is complete and readable */
  let replayTimer = null;
  function replay() {
    const btn = $("replayBtn");
    if (replayTimer) { stopReplay(); return; }
    const P = cashPts(); let i = 0;
    btn.setAttribute("aria-pressed", "true"); btn.querySelector("span").textContent = "Stop";
    const step = () => {
      drawCash(i, false); hl(P[i].key);
      const mo = M.moments.filter((x) => x.key === P[i].key).map((x) => x.text);
      $("replayLine").replaceChildren(h("b", { text: P[i].m.long + ": " + inr(P[i].value, 0) + (P[i].fc ? " (forecast)" : "") }), mo.length ? " · " + mo.join(" · ") : "");
      i++;
      if (i >= P.length) { replayTimer = setTimeout(() => stopReplay(true), reduced() ? 1600 : 1400); return; }
      replayTimer = setTimeout(step, mo.length ? 1500 : reduced() ? 900 : 520);
    };
    step();
  }
  function stopReplay(done) {
    clearTimeout(replayTimer); replayTimer = null; hl(null);
    const btn = $("replayBtn"); btn.setAttribute("aria-pressed", "false"); btn.querySelector("span").textContent = "Replay";
    drawCash(undefined, false);
    if (done) $("replayLine").textContent = "Replay finished. " + M.months.length + " actual months and " + M.plan.months.length + " forecast months.";
  }
  $("replayBtn").addEventListener("click", replay);

  /* ================= SKETCH ================= */
  const allT = (() => { const t = M.fyTotals(M.curFY); const ms = M.months; const out = { months: ms, name: "All " + ms.length + " months", range: ms[0].short + "–" + last.short };
    ["inflow", "outflow", "clientIn", "otherIn", "opOut", "nonopOut"].forEach((f) => (out[f] = ms.reduce((s, m) => s + m[f], 0)));
    const byLine = {}; ms.forEach((m) => { for (const k in m.v) byLine[k] = (byLine[k] || 0) + m.v[k]; });
    out.clients = M.D.lines.filter((l) => l.client && byLine[l.id]).map((l) => ({ id: l.id, row: l.row, name: M.nice(l.name), short: M.short(l.name), amount: byLine[l.id], share: byLine[l.id] / out.clientIn })).sort((a, b) => b.amount - a.amount);
    const g = {}; ms.forEach((m) => { for (const k in m.groups) g[k] = (g[k] || 0) + m.groups[k]; });
    out.spend = Object.keys(g).filter((k) => M.D.lines.some((l) => l.group === k && l.dir === "out") && g[k] > 0).map((k) => ({ id: k, name: M.meta.groupNames[k], amount: g[k], nonop: k === "investment" })).sort((a, b) => b.amount - a.amount);
    out.byLine = byLine; out.work = (field, title) => M.work(title + " · " + out.name, inr(out[field]), "actual", ms.map((m) => ({ label: m.long, value: inr(m[field]), src: "" })).concat([{ label: "Total", value: inr(out[field]), src: "" }]), "", "Sum of months");
    void t; return out; })();
  let fySel = "cur";
  function renderSketch() {
    const opts = [["cur", M.FY.name], ["prev", M.FYprev ? M.FYprev.name : null], ["all", "All months"]].filter((o) => o[1]);
    $("fyPick").replaceChildren(...opts.map((o) => { const b = h("button", { type: "button", role: "radio", "aria-checked": String(o[0] === fySel), text: o[1] }); b.addEventListener("click", () => { fySel = o[0]; renderSketch(); }); return b; }));
    const T = fyT(fySel);
    $("ioKey").replaceChildren(h("span", {}, [h("i", { cls: "sw", style: "background:var(--ser-in)" }), "Client money in"]), h("span", {}, [h("i", { cls: "sw", style: "background:var(--ser-out)" }), "Operating money out"]));
    C.columns($("ioChart"), { groups: T.months.map((m) => ({ key: m.key, label: m.short, values: [m.clientIn, m.opOut], m })), series: [{ color: "var(--ser-in)" }, { color: "var(--ser-out)" }], fmt: tickFmt,
      onHover: (k, e, g) => { hl(k); showTip(e, g.m.long, [{ label: "Client money in", value: inr(g.m.clientIn), color: "var(--ser-in)" }, { label: "Operating out", value: inr(g.m.opOut), color: "var(--ser-out)" }, { label: "Difference", value: inr(g.m.clientIn - g.m.opOut) }], false); }, onLeave: leave });
    $("ioChart").setAttribute("aria-label", "Column chart, " + T.name + ": client money in and operating money out for each month. Totals " + inr(T.clientIn) + " in and " + inr(T.opOut) + " out. The table has every figure.");
    $("tbl-io").replaceChildren(table(["Month", "Client money in", "Other in", "Operating out", "Fixed deposit out", "Net"], T.months.map((m) => [m.long, inr(m.clientIn), inr(m.otherIn), inr(m.opOut), inr(m.nonopOut), inr(m.net)]).concat([["Total", inr(T.clientIn), inr(T.otherIn), inr(T.opOut), inr(T.nonopOut), inr(T.inflow - T.outflow)]]), ["l", "r", "r", "r", "r", "r"], { meta: T.months.map((m) => ({ key: m.key })).concat([{ cls: "tot" }]) }));
    $("h-clients").textContent = "Where client money came from · " + T.name;
    C.hbars($("clients"), T.clients.slice(0, 10).map((c) => ({ name: c.short, full: c.name, value: c.amount, text: inr(c.amount, 0), sub: pct(c.share), w: "client:" + c.id + ":" + fySel })));
    if (T.clients.length > 10) { const rest = T.clients.slice(10), rs = rest.reduce((s, c) => s + c.amount, 0); $("clients").append(h("p", { cls: "src", text: rest.length + " more clients: " + inr(rs, 0) + " together (" + pct(rs / T.clientIn) + "). Total client money " + inr(T.clientIn) + "." })); }
    else $("clients").append(h("p", { cls: "src", text: "Total client money " + inr(T.clientIn) + ". Share is of client money only." }));
    $("h-spend").textContent = "Where the money went · " + T.name;
    C.hbars($("spend"), T.spend.map((g) => ({ name: g.name, value: g.amount, text: inr(g.amount, 0), sub: g.nonop ? "not spend" : pct(g.amount / T.opOut), cls: g.nonop ? "nonop" : "out", w: "group:" + g.id + ":" + fySel })));
    $("spend").append(h("p", { cls: "src", text: "Operating spend " + inr(T.opOut) + ". Share is of operating spend; the fixed deposit placed is money set aside, not spend." }));
    /* week dots */
    const s = M.safety.value, bins = [1e5, 3e5, s], binOf = (v) => (v < bins[0] ? 0 : v < bins[1] ? 1 : v < bins[2] ? 2 : 3);
    const colors = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)"];
    C.weekDots($("weekDots"), { months: M.months.map((m) => ({ key: m.key, label: m.short, weeks: m.weeks.map((i) => Object.assign({ bin: binOf(M.weeks[i].close) }, M.weeks[i])) })), colors,
      onHover: (k, e, w) => { hl(k); showTip(e, "Week " + w.label + " " + w.start.slice(0, 4), [{ label: "Closing", value: inr(w.close), dot: "", style: "background:" + colors[w.bin] }, { label: "In", value: inr(w.inflow), color: "var(--in)" }, { label: "Out", value: inr(w.outflow), color: "var(--out)" }], false); }, onLeave: leave });
    const binLabels = ["Under " + lakh(bins[0], 0), lakh(bins[0], 0) + " to " + lakh(bins[1], 0), lakh(bins[1], 0) + " to the safety line", "Above the safety line (" + lakh(s) + ")"];
    const counts = [0, 0, 0, 0]; M.weeks.forEach((w) => counts[binOf(w.close)]++);
    $("weekKey").replaceChildren(...binLabels.map((l, i) => h("span", {}, [dot("", "background:" + colors[i] + ";box-shadow:inset 0 0 0 1px var(--line)"), l + " · " + counts[i] + " weeks"])));
    $("weekDots").setAttribute("aria-label", "Every week from " + M.weeks[0].label + " " + M.weeks[0].start.slice(0, 4) + " to " + M.weeks[M.weeks.length - 1].label + " as a dot, grouped by month and shaded by closing cash. " + binLabels.map((l, i) => l + ": " + counts[i] + " weeks").join("; ") + ".");
    /* budget vs actual */
    const items = M.budget.months.map((k) => { const m = M.MK[k]; return { key: k, label: M.monthShort(k), actual: m ? m.opOut : null, budget: M.budget.lines.reduce((a, l) => a + (l.v[k] || 0), 0) }; });
    C.budget($("budgetChart"), { items, fmt: tickFmt, onHover: (k, e, it) => { hl(k); showTip(e, M.monthLabel(k, true), it.actual != null ? [{ label: "Actual spend", value: inr(it.actual), color: "var(--ser-out)" }, { label: "Budget", value: inr(it.budget) }, { label: it.actual >= it.budget ? "Over" : "Under", value: inr(Math.abs(it.actual - it.budget)) }] : [{ label: "Budget", value: inr(it.budget), color: "var(--fc)" }], it.actual == null); }, onLeave: leave });
    $("budgetChart").setAttribute("aria-label", "Operating spend against the Outflow Forecast budget, " + M.monthLabel(M.budget.months[0], true) + " to " + M.monthLabel(M.budget.months[M.budget.months.length - 1], true) + ". " + items.filter((i) => i.actual != null).filter((i) => i.actual > i.budget).length + " of " + items.filter((i) => i.actual != null).length + " actual months were over budget.");
    $("budgetKey").replaceChildren(h("span", {}, [h("i", { cls: "sw", style: "background:var(--ser-out)" }), "Actual operating spend"]), h("span", {}, [h("i", { cls: "tickk" }), "Budget"]), h("span", {}, [h("i", { cls: "sw", style: "border:2px solid var(--fc)" }), "Budget, forecast months"]));
    /* other money */
    const om = M.D.lines.filter((l) => (l.dir === "in" && !l.client) || l.nonop).map((l) => ({ l, v: T.months.reduce((s, m) => s + (m.v[l.id] || 0), 0), ms: T.months.filter((m) => m.v[l.id]) })).filter((x) => x.v);
    $("otherMoney").replaceChildren(om.length ? table(["Line", "Direction", "Amount", "When"], om.map((x) => [M.nice(x.l.name), x.l.dir === "in" ? "In" : "Out", inr(x.v), x.ms.map((m) => m.short).join(", ")]), ["l", "l", "r", "l"]) : h("p", { cls: "src", text: "None in " + T.name + "." }));
  }

  /* ================= DECIDE (What-if) ================= */
  const wiState = { delay: {}, cutRow: null, cut: 0, ret: 0, from: M.fcKeys[0], result: M.plan };
  function initDecide() {
    $("wiLead").textContent = "Change one thing and watch " + M.plan.months.map((f) => f.long).join(" and ") + " move. With nothing changed this shows the plan exactly. Everything here is a forecast.";
    $("wiDelays").replaceChildren(...M.arItems.map((a) => {
      const sel = h("select", { "data-invoice": a.invoice, id: "wd-" + a.row }, [["0", "On the sheet's date (" + M.dateLabel(a.expected) + ")"], ["15", "15 days late"], ["30", "30 days late"], ["60", "60 days late"]].map((o) => h("option", { value: o[0], text: o[1] })));
      sel.addEventListener("change", () => { wiState.delay[a.invoice] = +sel.value; runWhatIf(); });
      return h("label", { cls: "field", for: "wd-" + a.row }, [h("span", {}, [h("span", { text: a.short + " · " + inr(a.amount, 0) })]), sel]);
    }));
    const lines = M.budget.lines.filter((l) => M.fcKeys.some((k) => l.v[k]));
    $("wiCutLine").replaceChildren(...lines.map((l) => h("option", { value: l.row, text: l.name + " (" + inr(l.v[M.fcKeys[0]] || 0, 0) + " a month)" })));
    wiState.cutRow = lines.length ? +lines[0].row : null;
    $("wiCutLine").addEventListener("change", (e) => { wiState.cutRow = +e.target.value; runWhatIf(); });
    $("wiCut").addEventListener("input", (e) => { wiState.cut = +e.target.value; $("wiCutOut").textContent = wiState.cut + "%"; runWhatIf(); });
    $("wiRet").addEventListener("input", (e) => { wiState.ret = +e.target.value; $("wiRetOut").textContent = inr(wiState.ret, 0); runWhatIf(); });
    $("wiRetFrom").replaceChildren(...M.fcKeys.map((k) => h("option", { value: k, text: M.monthLabel(k, true) })));
    $("wiRetFrom").addEventListener("change", (e) => { wiState.from = e.target.value; runWhatIf(); });
    $("wiReset").addEventListener("click", () => { wiState.delay = {}; wiState.cut = 0; wiState.ret = 0; wiState.from = M.fcKeys[0]; $("wiForm").reset(); $("wiCutOut").textContent = "0%"; $("wiRetOut").textContent = inr(0, 0); if (wiState.cutRow != null) $("wiCutLine").value = String(wiState.cutRow); runWhatIf(); });
    $("wiCutOut").textContent = "0%"; $("wiRetOut").textContent = inr(0, 0);
  }
  function runWhatIf() {
    const cut = {}; if (wiState.cutRow != null && wiState.cut) cut[wiState.cutRow] = wiState.cut;
    const r = M.whatIf({ delay: wiState.delay, cut, retainer: { amount: wiState.ret, from: wiState.from } });
    wiState.result = r;
    const P = M.plan, endP = P.end, endW = r.end, same = r.months.every((f, i) => f.close === P.months[i].close);
    const lo = r.months.reduce((a, b) => (b.close < a.close ? b : a)), neg = r.months.find((f) => f.close < 0);
    const lastF = r.months[r.months.length - 1];
    $("wiVerdict").replaceChildren(...(same
      ? ["No changes: this is the plan exactly. Cash ends " + lastF.long + " at ", h("b", { text: inr(endW) }), "."]
      : ["Cash ends " + lastF.long + " at ", h("b", { text: inr(endW) }), ", " + (endW >= endP ? inr(endW - endP, 0) + " better" : inr(endP - endW, 0) + " worse") + " than the plan (" + inr(endP, 0) + "). " + (neg ? "It still goes below zero in " + neg.long + "." : lo.close < M.safety.value ? "It stays above zero but below the safety line." : "It stays above the safety line.")]),
      r.slipped.length ? " " + r.slipped.map((s) => s.name + " (" + inr(s.amount, 0) + ") would land after " + M.monthLabel(M.horizonEnd, true) + ", outside the plan.").join(" ") : "");
    const hist = M.months.slice(-4), keys = hist.map((m) => ({ key: m.key, label: m.short, fc: false })).concat(r.months.map((f) => ({ key: f.key, label: f.short, fc: true })));
    const nh = hist.length, pad = (arr) => hist.map((m, i) => (i === nh - 1 ? last.close : null)).concat(arr);
    C.lines($("wiChart"), { keys, fmt: tickFmt, safety: M.safety.value, right: 200, series: [
      { id: "actual", name: "Actual", color: "var(--in)", values: hist.map((m) => m.close).concat(r.months.map(() => null)), end: false },
      { id: "plan", name: "Plan", color: "var(--axis)", dash: "5 5", values: pad(P.months.map((f) => f.close)), dots: false, endText: "Plan " + lakh(endP) },
      { id: "wi", name: "What-if", color: "var(--fc)", values: pad(r.months.map((f) => f.close)), dotFrom: nh, endText: "What-if " + lakh(endW) }],
      onHover: (k, e) => { hl(k); const f = r.months.find((x) => x.key === k), pf = planK[k], m = M.MK[k]; showTip(e, M.monthLabel(k, true), f ? [{ dot: "ring", label: "What-if", value: inr(f.close) }, { label: "Plan", value: inr(pf.close), color: "var(--axis)", dash: true }] : [{ dot: "in", label: "Closing", value: inr(m.close) }], !!f); }, onLeave: leave });
    $("wiChart").setAttribute("aria-label", "Line chart: the last four actual months, then the plan and the what-if for " + r.months.map((f) => f.long + " (plan " + inr(planK[f.key].close) + ", what-if " + inr(f.close) + ")").join(" and ") + ".");
    $("wiKey").replaceChildren(h("span", {}, [dot("in"), "Actual"]), h("span", {}, [h("i", { cls: "ln dash", style: "border-color:var(--axis)" }), "Plan"]), h("span", {}, [dot("fc"), "What-if (forecast)"]), h("span", {}, [h("i", { cls: "ln safe" }), "Safety line"]));
    $("wiTable").replaceChildren(table(["Month", "What-if closing", "Plan closing", "Difference", "In", "Out"], r.months.map((f) => { const pf = planK[f.key]; return [f.long, wbtn(inr(f.close), "wi:" + f.key, "", f.long + " what-if closing " + inr(f.close) + ". Show working."), inr(pf.close), (f.close - pf.close > 0 ? "+" : "") + inr(f.close - pf.close), inr(f.inflow), inr(f.outflow)]; }), ["l", "r", "r", "r", "r", "r"], { meta: r.months.map((f) => ({ key: f.key, cls: "fc" })), caption: "What-if by month (forecast)" }));
  }

  /* ================= PROTOTYPE ================= */
  function renderPrototype() {
    $("protoLead").textContent = "Same starting cash (" + inr(last.close, 0) + " on " + M.dateLabel(M.meta.actualTo) + "), four sets of assumptions. All four are forecasts, drawn on the same scale; the dashed line is the plan.";
    const hist = M.months.slice(-4), nh = hist.length;
    const all = M.scenarios.flatMap((s) => s.f.months.map((f) => f.close)).concat(hist.map((m) => m.close));
    const dom = [Math.min(...all), Math.max(...all)];
    $("scKey").replaceChildren(h("span", {}, [dot("in"), "Actual"]), h("span", {}, [dot("fc"), "Scenario (forecast)"]), h("span", {}, [h("i", { cls: "ln dash", style: "border-color:var(--axis)" }), "Plan, for comparison"]));
    $("scList").replaceChildren(...M.scenarios.map((sc) => {
      const f = sc.f.months, end = f[f.length - 1], lo = f.reduce((a, b) => (b.close < a.close ? b : a));
      const chart = h("div", { cls: "chart", role: "img", "aria-label": sc.name + ": cash " + f.map((x) => x.long + " " + inr(x.close)).join(", ") + " (forecast)." });
      const li = h("li", { cls: sc.id === "plan" ? "on" : null }, [h("span", { cls: "nm", text: sc.name }), chart,
        h("span", { cls: "l src" }, [tag(true), " " + end.long + " closing"]), wbtn(inr(end.close, 0), "sc:" + sc.id, "end", sc.name + ", " + end.long + " closing " + inr(end.close) + ". Show working."),
        h("span", { cls: "note", text: "Lowest: " + inr(lo.close, 0) + " in " + lo.long + ". " + sc.note })]);
      li._draw = () => C.lines(chart, { keys: hist.map((m) => ({ key: m.key, label: m.short.slice(0, 3), fc: false })).concat(f.map((x) => ({ key: x.key, label: x.short.slice(0, 3), fc: true }))), height: 150, endLabels: false, fcLabel: false, domain: dom, tickCount: 3, fmt: tickFmt,
        series: [{ id: "a", color: "var(--in)", values: hist.map((m) => m.close).concat(f.map(() => null)) },
          sc.id !== "plan" ? { id: "p", color: "var(--axis)", dash: "5 5", dots: false, values: hist.map((m, i) => (i === nh - 1 ? last.close : null)).concat(M.plan.months.map((x) => x.close)) } : null,
          { id: sc.id, color: "var(--fc)", dotFrom: nh, values: hist.map((m, i) => (i === nh - 1 ? last.close : null)).concat(f.map((x) => x.close)) }].filter(Boolean),
        onHover: (k, e) => { hl(k); const x = f.find((y) => y.key === k), m = M.MK[k]; showTip(e, M.monthLabel(k, true), x ? [{ dot: "ring", label: sc.name, value: inr(x.close) }, { label: "Plan", value: inr(planK[k].close), color: "var(--axis)", dash: true }] : [{ dot: "in", label: "Closing", value: inr(m.close) }], !!x); }, onLeave: leave });
      return li;
    }));
    [...$("scList").children].forEach((li) => li._draw());
    /* checkpoint table (after the Cash Course): what each plan month needs */
    const s = M.safety.value;
    $("planTable").replaceChildren(table(["Checkpoint", "Plan closing", "Against zero", "Against the safety line", "Needed in to stay at zero"],
      M.plan.months.map((f) => [h("span", {}, [f.long, h("span", { cls: "sub", text: "Forecast · " + f.lines.length + " budget lines, " + f.receipts.length + " receipt" + (f.receipts.length === 1 ? "" : "s") })]), wbtn(inr(f.close), "fc:" + f.key, "", f.long + " plan closing " + inr(f.close) + ". Show working."), f.close < 0 ? "Below by " + inr(-f.close, 0) : "Above", f.close < s ? "Short by " + inr(s - f.close, 0) : "Above", f.close < 0 ? inr(-f.close, 0) + " by " + M.dateLabel(f.key + "-" + String(new Date(+f.key.slice(0, 4), +f.key.slice(5), 0).getDate())) : "–"]),
      ["l", "r", "r", "r", "r"], { meta: M.plan.months.map((f) => ({ key: f.key, cls: "fc" })), caption: "Checkpoints on the plan" }));
  }

  /* ================= TEST ================= */
  function renderTest() {
    const extra = D.checks.filter((c) => !M.checks.some((m) => m.id === c.id));
    const all = M.checks.concat(extra), ok = all.filter((c) => c.ok).length;
    $("testLead").textContent = ok === all.length ? "Yes. Every figure is recalculated in your browser from the workbook and checked: all " + all.length + " checks pass." : ok + " of " + all.length + " checks pass. The failing ones are marked below.";
    const tick = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.6 2.5L10 3.5"/></svg>', cross = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg>';
    $("checks").replaceChildren(...all.map((c) => { const k = h("span", { cls: "ok" + (c.ok ? "" : " bad") }); k.innerHTML = c.ok ? tick : cross; return h("li", {}, [k, h("div", {}, [h("b", { text: c.name }), h("div", { cls: "d", text: (c.ok ? "Pass · " : "Fails · ") + c.detail })])]); }));
    const s = last.sheet;
    const xs = [["Opening balance, " + last.long, last.open, "Cash Flow Forecast!" + s.col + M.meta.rows.open, s.open],
      ["Money in, " + last.long, last.inflow, "Cash Flow Forecast!" + s.col + M.meta.rows.inflow, s.inflow],
      ["Money out, " + last.long, last.outflow, "Cash Flow Forecast!" + s.col + M.meta.rows.outflow, s.outflow],
      ["Closing balance, " + last.long, last.close, "Cash Flow Forecast!" + s.col + M.meta.rows.close, s.close],
      ["Cash per bank statement, " + M.dateLabel(D.bank.lastTxn), last.close, "Bank Statement, last running balance", D.bank.lastBalance]];
    $("xcheck").replaceChildren(h("p", { cls: "src", text: "The dashboard works each figure out from the weekly columns; the workbook cell is the sheet's own monthly summary or the bank statement." }),
      table(["Figure", "Dashboard", "Workbook cell", "Workbook value", "Match"], xs.map((x) => [x[0], inr(x[1]), x[2], inr(x[3]), Math.abs(x[1] - x[3]) < 0.005 ? "Exact" : "Off by " + inr(x[1] - x[3])]), ["l", "r", "l", "r", "l"]));
    $("quirks").replaceChildren(...D.quirks.map((q) => h("li", { text: q.text })));
    $("allMonths").replaceChildren(table(["Month", "Opening", "Money in", "Money out", "Closing", "Sheet column", "Balances"], M.months.map((m) => [m.long, inr(m.open), inr(m.inflow), inr(m.outflow), wbtn(inr(m.close), "m:" + m.key + ":close", "", m.long + " closing " + inr(m.close) + ". Show working."), m.sheet ? m.sheet.col : "–", Math.abs(m.open + m.inflow - m.outflow - m.close) < 0.005 ? "Yes" : "No"]), ["l", "r", "r", "r", "r", "l", "l"], { meta: M.months.map((m) => ({ key: m.key })), caption: "Every actual month" }));
    $("srcLine").textContent = "Source: " + M.meta.source + " (" + M.meta.company + "), saved " + M.meta.saved + " by " + M.meta.savedBy.replace(/\s+/g, " ") + ". Sheets read: Cash Flow Forecast, Bank Statement, Bank Balance, Outflow Forecast, AR Outstanding, Advances Summary, Bad Debts. Dashboard refreshed " + M.meta.generated + ".";
  }

  /* ================= ASK ================= */
  function renderAnswer(q, a) {
    const log = $("chatLog");
    if (q) log.append(h("li", { cls: "msg q", text: q }));
    const parts = [h("p", { text: a.text })];
    if (a.facts && a.facts.length) parts.push(h("div", { cls: "facts" }, a.facts.map((f) => h("div", {}, [h("span", { cls: "v num", text: f.v }), h("span", { cls: "l", text: f.l })]))));
    if (a.chart && a.chart.length) { const box = h("div", { cls: "hbars" }); C.hbars(box, a.chart.map((c) => ({ name: c.name, value: c.value, text: c.text, cls: c.cls }))); box.querySelectorAll("button").forEach((b) => { b.disabled = true; b.removeAttribute("aria-label"); b.style.cursor = "default"; }); parts.push(box); }
    if (a.table) parts.push(table(a.table.head, a.table.rows.slice(0, 20), a.table.align));
    if (a.status !== "none") parts.push(h("p", { cls: "meta" }, [a.status === "forecast" ? tag(true) : tag(false), a.periods ? h("span", { text: a.periods }) : null, a.source ? h("span", { text: "Source: " + a.source }) : null, a.w ? wbtn("Show working", a.w) : null]));
    const li = h("li", { cls: "msg a" }, parts);
    log.append(li);
    setChips(a.suggest && a.suggest.length ? a.suggest : A.suggestions.slice(0, 5));
    if (q) li.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
  }
  function setChips(list) { $("chips").replaceChildren(...list.map((s) => { const b = h("button", { type: "button", cls: "chip", text: s }); b.addEventListener("click", () => ask(s)); return b; })); }
  function ask(q) { renderAnswer(q, A.answer(q)); }
  function initAsk() {
    renderAnswer(null, { text: "Ask about cash, money in and out, costs, clients, runway, the plan, what's owed, or whether the books balance. Answers show the figures, the months, whether they are actual or forecast, and where in the workbook they come from.", status: "none", suggest: A.suggestions.slice(0, 6) });
    $("chatForm").addEventListener("submit", (e) => { e.preventDefault(); const v = $("chatIn").value.trim(); if (!v) return; $("chatIn").value = ""; ask(v); });
    const ac = $("askClaude"); if (ASK_CLAUDE_URL) ac.href = ASK_CLAUDE_URL; else ac.hidden = true;
  }
  window.TSAskUI = { ask };

  /* ================= routing + rendering ================= */
  const STAGES = ["map", "sketch", "decide", "prototype", "test", "ask"];
  const drawn = {};
  const DRAW = {
    map: (first) => drawCash(undefined, first),
    sketch: renderSketch,
    decide: runWhatIf,
    prototype: renderPrototype,
  };
  function show(stage) {
    if (!STAGES.includes(stage)) stage = "map";
    if (replayTimer && stage !== "map") stopReplay();
    STAGES.forEach((s) => { $("s-" + s).hidden = s !== stage; const a = document.querySelector('[data-tab="' + s + '"]'); if (s === stage) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const at = document.querySelector('[data-tab="' + stage + '"]'), tb = $("tabs"); if (tb.scrollWidth > tb.clientWidth) tb.scrollLeft = Math.max(0, at.offsetLeft - (tb.clientWidth - at.offsetWidth) / 2);
    hideTip(); hl(null);
    if (DRAW[stage]) DRAW[stage](!drawn[stage]);
    drawn[stage] = true;
  }
  function route() { show((location.hash || "#map").slice(1)); }
  addEventListener("hashchange", () => { route(); $("main").focus({ preventScroll: true }); scrollTo(0, 0); });
  let rz = null, lastW = innerWidth;
  addEventListener("resize", () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rz); rz = setTimeout(() => { const st = (location.hash || "#map").slice(1); if (DRAW[st] && !replayTimer) DRAW[st](false); }, 150); });

  /* theme: follows the device until the button is used */
  $("themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const nxt = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nxt; try { localStorage.setItem("ts.theme", nxt); } catch (e) { /* private mode */ }
    $("themeBtn").setAttribute("aria-label", nxt === "dark" ? "Switch to light" : "Switch to dark");
  });

  /* ================= gate ================= */
  async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
  function unlocked() { try { return localStorage.getItem(OK_KEY) === PASS_HASH || sessionStorage.getItem(OK_KEY) === PASS_HASH; } catch (e) { return false; } }
  let started = false;
  function start() {
    if (started) return; started = true;
    document.body.classList.remove("gated"); $("gate").hidden = true; $("app").hidden = false;
    renderShell(); renderMap(); initDecide(); renderTest(); initAsk();
    route();
  }
  function gate() {
    document.body.classList.add("gated"); $("gate").hidden = false; $("app").hidden = true;
    const f = $("gateForm"), inp = $("pc"), err = $("pcErr");
    setTimeout(() => inp.focus(), 50);
    const sb = $("pcShow");
    sb.addEventListener("click", () => {
      const show = inp.type === "password";
      inp.type = show ? "text" : "password";
      sb.textContent = show ? "Hide" : "Show";
      sb.setAttribute("aria-pressed", String(show));
      sb.setAttribute("aria-label", show ? "Hide passcode" : "Show passcode");
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ok = (await sha(inp.value)) === PASS_HASH;
      if (!ok) {
        err.textContent = "That passcode didn't match. Check it and try again.";
        f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake");
        inp.select(); return;
      }
      err.textContent = "";
      try { (($("rem").checked) ? localStorage : sessionStorage).setItem(OK_KEY, PASS_HASH); } catch (x) { /* storage blocked: unlock for this view only */ }
      const g = $("gate"); g.classList.add("on");
      const t1 = reduced() ? 0 : 1100, t2 = reduced() ? 0 : 700;
      setTimeout(() => { g.classList.add("leaving"); setTimeout(start, t2); }, t1);
    });
  }
  $("lockBtn").addEventListener("click", () => { try { localStorage.removeItem(OK_KEY); sessionStorage.removeItem(OK_KEY); } catch (e) { /* ignore */ } location.reload(); });

  if (unlocked()) start(); else gate();
})();
