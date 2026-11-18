// Browser checks for the Thinking Spree cash dashboard.
// Run (with the site served on 127.0.0.1:8780):
//   python -m http.server 8780 --bind 127.0.0.1
//   playwright-cli open about:blank
//   playwright-cli run-code "$(cat tools/test-dashboard.js)"
// Expected values are worked out here straight from window.TS_DATA (the workbook data), not from the app's model.
async (page) => {
  const BASE = "http://127.0.0.1:8780/";
  const PASS = "Spree@Studio2026";
  const SHOTS = "C:/Users/Rohit SRF/Thinking Spree Dashboard/.impeccable/review/";
  const R = [], errors = [];
  const ok = (name, cond, info) => R.push((cond ? "PASS " : "FAIL ") + name + (info !== undefined && !cond ? "  [" + info + "]" : ""));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const cdp = await page.context().newCDPSession(page); await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const go = async (tab) => { await page.evaluate((t) => { location.hash = t; }, tab); await page.waitForTimeout(350); };

  /* ---------- passcode gate ---------- */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload(); await page.waitForTimeout(500);
  ok("gate shows on a fresh device", await page.isVisible("#gate .note"));
  ok("no figures behind the gate", !(await page.isVisible("#figs")));
  await page.screenshot({ path: SHOTS + "gate.png" });
  ok("lock screen shows the client logo", await page.evaluate(() => { const i = document.querySelector("#gate image"); return !!i && /ts-logo\.png$/.test(i.getAttribute("href")) && i.getBBox().width > 0; }));
  ok("door tag says Open", await page.evaluate(() => document.querySelector("#gate .door text").textContent === "Open"));
  await page.fill("#pc", "abc"); await page.click("#pcShow");
  ok("Show reveals the passcode", await page.evaluate(() => document.getElementById("pc").type === "text" && document.getElementById("pcShow").getAttribute("aria-pressed") === "true"));
  await page.click("#pcShow");
  ok("Hide masks it again", await page.evaluate(() => document.getElementById("pc").type === "password" && document.getElementById("pcShow").textContent === "Show"));
  await page.fill("#pc", "wrong-code"); await page.press("#pc", "Enter"); await page.waitForTimeout(300);
  ok("wrong passcode is refused with a plain message", (await page.textContent("#pcErr")).includes("didn't match"));
  ok("wrong passcode shakes the note", await page.evaluate(() => document.getElementById("gateForm").classList.contains("shake")));
  await page.fill("#pc", PASS); await page.press("#pc", "Enter");
  await page.waitForTimeout(500);
  ok("right passcode switches the lamp on", await page.evaluate(() => document.getElementById("gate").classList.contains("on")));
  await page.waitForTimeout(1800);
  ok("right passcode opens the dashboard", !(await page.isVisible("#gate")) && (await page.isVisible("#figs")));
  ok("device is remembered", !!(await page.evaluate(() => localStorage.getItem("ts.ok"))));
  await page.reload(); await page.waitForTimeout(500);
  ok("stays open after reload", !(await page.isVisible("#gate")) && (await page.isVisible("#figs")));

  /* ---------- independent expectations from the workbook data ---------- */
  const X = await page.evaluate(() => {
    const D = window.TS_DATA, L = {}; D.lines.forEach((l) => (L[l.id] = l));
    const f2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), f0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
    const inr = (v, dp) => (v < 0 ? "−⁠" : "") + "₹" + (dp === 0 ? f0.format(Math.round(Math.abs(v))) : f2.format(Math.round(Math.abs(v) * 100) / 100));
    const ms = D.months, last = ms[ms.length - 1], fy = (k) => (+k.slice(5) >= 4 ? +k.slice(0, 4) : +k.slice(0, 4) - 1), curFY = fy(last.key);
    const sumL = (months, pred) => months.reduce((s, m) => s + Object.keys(m.v).filter((k) => pred(L[k])).reduce((a, k) => a + m.v[k], 0), 0);
    const FY = ms.filter((m) => fy(m.key) === curFY), FYp = ms.filter((m) => fy(m.key) === curFY - 1);
    const last6 = ms.slice(-6), op6 = sumL(last6, (l) => l.dir === "out" && !l.nonop), days6 = last6.reduce((s, m) => s + new Date(+m.key.slice(0, 4), +m.key.slice(5), 0).getDate(), 0);
    const fcKeys = D.budget.months.filter((k) => k > last.key);
    const bud = (k) => D.budget.lines.reduce((s, l) => s + (l.v[k] || 0), 0);
    const arIn = (k) => D.ar.filter((a) => a.expected && a.expected.slice(0, 7) === k).reduce((s, a) => s + a.amount, 0);
    let open = last.close; const plan = fcKeys.map((k) => { const c = Math.round((open + arIn(k) - bud(k)) * 100) / 100; const r = { key: k, in: arIn(k), out: bud(k), close: c }; open = c; return r; });
    let o2 = last.close; const slip = fcKeys.map((k) => { o2 = Math.round((o2 - bud(k)) * 100) / 100; return o2; });
    const nen = D.lines.find((l) => l.client && /National Entrepreneurship/i.test(l.name)), trv = D.lines.find((l) => /TRAVEZY/i.test(l.name));
    const lo = ms.reduce((a, b) => (b.close < a.close ? b : a));
    const salFY = sumL(FY, (l) => l.group === "salaries"), salFYp = sumL(FYp, (l) => l.group === "salaries");
    return {
      lastClose: inr(last.close), lastLong: last.key, oct: { in: inr(last.inflow), out: inr(last.outflow) },
      monthsN: ms.length, weeksN: D.weeks.length, planN: fcKeys.length, plan: plan.map((p) => ({ key: p.key, close: inr(p.close), close0: inr(p.close, 0), raw: p.close })), slipEnd: inr(slip[slip.length - 1], 0),
      fyClient: inr(sumL(FY, (l) => l.client)), fyClient0: inr(sumL(FY, (l) => l.client), 0), fyOp0: inr(sumL(FY, (l) => l.dir === "out" && !l.nonop), 0), salFY0: inr(salFY, 0), salFYp: inr(salFYp),
      fyClientsN: FY.length ? new Set(FY.flatMap((m) => Object.keys(m.v).filter((k) => L[k].client && m.v[k]))).size * 2 : 0,
      runwayDays: String(Math.floor(last.close / (op6 / days6))),
      arTotal: inr(D.ar.reduce((s, a) => s + a.amount, 0)), nenFY: inr(sumL(FY, (l) => l === nen)), trvAll: inr(sumL(ms, (l) => l === trv)),
      may26: inr(ms.find((m) => m.key === "2026-05").close), low: inr(lo.close), budOct0: inr(bud(last.key), 0), fyMonths: FY.length,
      sheetCells: [last.sheet.open, last.sheet.inflow, last.sheet.outflow, last.sheet.close].map((v) => inr(v)),
    };
  });

  /* ---------- MAP ---------- */
  await go("map");
  ok("lead figure = closing cash in the workbook", (await page.textContent("#figs .lead-fig .v")).trim() === X.lastClose, await page.textContent("#figs .lead-fig .v"));
  ok("Books balance badge shows", (await page.textContent("#booksBadge")).includes("Books balance"));
  ok("verdict names the month the plan runs out", (await page.textContent("#h-map")).includes("November 2026"));
  const pts = await page.$$eval("#cashChart circle.pt", (e) => e.length);
  ok("cash chart has a dot for every month (actual + plan)", pts === X.monthsN + X.planN, pts);
  ok("forecast dots are rings", (await page.$$eval("#cashChart circle.pt", (e) => e.filter((c) => c.getAttribute("style").includes("fill:var(--paper)")).length)) === X.planN);
  const marg = await page.$$eval("#cashMargin li", (e) => e.map((x) => x.textContent));
  ok("margin lists exact month-ends including the plan", marg.length === 8 && marg[marg.length - 1].includes(X.plan[X.planN - 1].close0), marg.join(" | "));
  ok("watch list has dot-ranked notes", (await page.$$eval("#watch .note-i", (e) => e.length)) >= 4);
  await page.screenshot({ path: SHOTS + "desktop.png" });
  /* show working */
  await page.click("#figs .lead-fig .v");
  await page.waitForTimeout(200);
  ok("Show working opens", await page.isVisible("#work"));
  const steps = await page.$$eval("#workSteps li", (e) => e.map((x) => x.textContent));
  ok("Show working gives the sum and the cell", steps.length === 4 && steps.join(" ").includes("row 91") && steps[3].includes(X.lastClose), steps.join(" | "));
  await page.keyboard.press("Escape"); await page.waitForTimeout(150);
  ok("Escape closes Show working and returns focus", !(await page.isVisible("#work")) && (await page.evaluate(() => document.activeElement && document.activeElement.closest(".lead-fig") !== null)));
  /* hover sync */
  const box = await page.$eval("#cashChart svg", (s) => { const r = s.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + box.w * 0.6, box.y + box.h / 2); await page.waitForTimeout(150);
  const hlN = await page.$$eval(".hl", (e) => e.length);
  ok("hovering a month lights it up", hlN >= 2, hlN);
  ok("tooltip shows on hover", await page.isVisible("#tip"));
  await page.mouse.move(5, 5);
  /* table view */
  await page.click('[data-table="cash"]'); await page.waitForTimeout(100);
  ok("cash table view opens with every month", (await page.$$eval("#tbl-cash tbody tr", (e) => e.length)) === X.monthsN + X.planN);
  await page.click('[data-table="cash"]');
  /* replay */
  await page.click("#replayBtn"); await page.waitForTimeout(1300);
  const rl = await page.textContent("#replayLine");
  ok("Replay steps through months", rl.length > 5 && (await page.getAttribute("#replayBtn", "aria-pressed")) === "true", rl);
  const midPts = await page.$$eval("#cashChart circle.pt", (e) => e.length);
  ok("each Replay frame shows only months so far", midPts > 0 && midPts < X.monthsN + X.planN, midPts);
  await page.click("#replayBtn"); await page.waitForTimeout(200);
  ok("Replay stops and restores the full chart", (await page.$$eval("#cashChart circle.pt", (e) => e.length)) === X.monthsN + X.planN);

  /* ---------- SKETCH ---------- */
  await go("sketch");
  ok("Sketch: in/out columns, one pair per month this year", (await page.$$eval("#ioChart path.bar", (e) => e.length)) === X.fyMonths * 2);
  ok("Sketch: top client is NEN", (await page.textContent("#clients .hb .nm")).trim() === "NEN");
  ok("Sketch: every week is a dot", (await page.$$eval("#weekDots circle.pt", (e) => e.length)) === X.weeksN);
  ok("Sketch: budget chart drawn", (await page.$$eval("#budgetChart path", (e) => e.length)) >= 12);
  await page.click("#clients .hb"); await page.waitForTimeout(150);
  ok("Sketch: client bar shows its working", (await page.textContent("#workTitle")).includes("National Entrepreneurship"));
  await page.keyboard.press("Escape");
  await page.screenshot({ path: SHOTS + "sketch.png", fullPage: true });

  /* ---------- DECIDE (What-if) ---------- */
  await go("decide");
  const wiClose = () => page.$$eval("#wiTable tbody tr", (rows) => rows.map((r) => [...r.children].map((c) => c.textContent.trim())));
  let t = await wiClose();
  ok("What-if with no changes = the plan exactly (text)", (await page.textContent("#wiVerdict")).includes("plan exactly"));
  ok("What-if with no changes = the plan exactly (every month, to the paisa)", t.length === X.planN && t.every((r, i) => r[1] === X.plan[i].close && r[2] === X.plan[i].close && /₹0\.00$/.test(r[3])), JSON.stringify(t));
  await page.$eval("#wiRet", (e) => { e.value = 100000; e.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(150); t = await wiClose();
  ok("What-if: a ₹1,00,000 retainer from the first month adds ₹1,00,000 per month", t[t.length - 1][3] === "+₹" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(100000 * X.planN), t[t.length - 1][3]);
  await page.click("#wiReset"); await page.waitForTimeout(150);
  await page.selectOption("#wiCutLine", { label: await page.$eval("#wiCutLine option", (o) => o.textContent) });
  await page.$eval("#wiCut", (e) => { e.value = 10; e.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForTimeout(150); t = await wiClose();
  ok("What-if: cutting salaries 10% improves the plan", t[0][3].startsWith("+₹63,500.00"), t[0][3]);
  await page.click("#wiReset"); await page.waitForTimeout(150); t = await wiClose();
  ok("What-if: back to the plan resets exactly", t.every((r, i) => r[1] === X.plan[i].close) && (await page.textContent("#wiVerdict")).includes("plan exactly"));
  await page.click("#wiTable tbody tr button"); await page.waitForTimeout(150);
  ok("What-if months show their working", (await page.isVisible("#work")) && (await page.textContent("#workStatus")).includes("Forecast"));
  await page.keyboard.press("Escape");
  await page.screenshot({ path: SHOTS + "decide.png" });

  /* ---------- PROTOTYPE ---------- */
  await go("prototype");
  const sc = await page.$$eval("#scList li", (e) => e.map((x) => x.querySelector(".end").textContent.trim()));
  ok("Prototype: four scenarios", sc.length === 4);
  ok("Prototype: plan scenario ends where the plan ends", sc[0] === X.plan[X.planN - 1].close0, sc[0]);
  ok("Prototype: 'receivables slip' = plan without the open invoices", sc[2] === X.slipEnd, sc[2] + " vs " + X.slipEnd);
  ok("Prototype: four small charts on one scale", (await page.$$eval("#scList svg", (e) => e.length)) === 4);

  /* ---------- TEST ---------- */
  await go("test");
  const checks = await page.$$eval("#checks li .ok", (e) => e.map((x) => !x.classList.contains("bad")));
  ok("Test: every check passes", checks.length >= 9 && checks.every(Boolean), checks.length);
  const xc = await page.$$eval("#xcheck tbody tr", (rows) => rows.map((r) => [...r.children].map((c) => c.textContent.trim())));
  ok("Test: five key figures match the workbook exactly", xc.length === 5 && xc.every((r) => r[4] === "Exact") && xc.slice(0, 4).every((r, i) => r[3] === X.sheetCells[i]), JSON.stringify(xc));

  /* ---------- ASK: 15 questions checked against the data ---------- */
  await go("ask");
  const Q = [
    ["What is the cash balance now?", [X.lastClose]],
    ["How much came in and went out in October 2026?", [X.oct.in, X.oct.out]],
    ["What were the top costs this year?", ["Salaries & consultants " + X.salFY0]],
    ["Which clients paid us this year?", [X.fyClient]],
    ["How long will the cash last?", [X.runwayDays + " days"]],
    ["What changed vs last month?", ["October 2026 vs September 2026"]],
    ["What does the plan say for December?", [X.plan[X.planN - 1].close, "forecast"]],
    ["Who still owes us money?", [X.arTotal, "Elecroom"]],
    ["How much did NEN pay this year?", [X.nenFY]],
    ["Do the books balance?", ["Yes"]],
    ["Cash at the end of May 2026", [X.may26]],
    ["Salaries in FY25-26", [X.salFYp]],
    ["What was the lowest month?", [X.low, "August 2025"]],
    ["Budget vs actual in October", [X.budOct0]],
    ["How much did Travezy pay in total?", [X.trvAll]],
    ["purple monkeys", ["didn't understand"]],
  ];
  for (const [q, want] of Q) {
    await page.fill("#chatIn", q); await page.press("#chatIn", "Enter"); await page.waitForTimeout(120);
    const a = await page.$eval("#chatLog li.msg.a:last-child", (e) => e.textContent);
    ok("Ask: " + q, want.every((w) => a.includes(w)), a.slice(0, 220));
  }
  ok("Ask: answers name the source and actual/forecast", (await page.$$eval("#chatLog li.msg.a .meta", (e) => e.filter((x) => /Source:/.test(x.textContent) && /(Actual|Forecast)/.test(x.textContent)).length)) >= 14);
  ok("Ask: Ask Claude button links to the private page", (await page.getAttribute("#askClaude", "href")).startsWith("https://claude.ai/artifact/") && await page.isVisible("#askClaude"));
  ok("Ask: suggested questions offered", (await page.$$eval("#chips .chip", (e) => e.length)) >= 3);
  await page.screenshot({ path: SHOTS + "ask.png" });

  /* ---------- keyboard ---------- */
  await go("map");
  await page.focus("#tabs a[data-tab=sketch]"); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  ok("keyboard: tabs work with Enter", await page.isVisible("#s-sketch"));

  /* ---------- dark mode ---------- */
  await go("map");
  await page.click("#themeBtn"); await page.waitForTimeout(200);
  const dark = await page.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor]);
  await page.screenshot({ path: SHOTS + "desktop-" + dark[0] + ".png" });
  await page.click("#themeBtn"); await page.waitForTimeout(150);
  const light = await page.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.body).backgroundColor]);
  ok("light and dark both switch", dark[1] !== light[1], dark.join() + " / " + light.join());

  /* ---------- phone ---------- */
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["map", "sketch", "decide", "prototype", "test", "ask"]) {
    await go(tab); await page.waitForTimeout(250);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok("phone: no sideways scroll on " + tab, over <= 0, over);
    if (tab === "map") await page.screenshot({ path: SHOTS + "mobile.png" });
    if (tab === "decide") await page.screenshot({ path: SHOTS + "mobile-decide.png", fullPage: true });
  }
  await go("map");
  await page.click("#figs .lead-fig .v"); await page.waitForTimeout(200);
  const sheet = await page.$eval("#work", (e) => { const r = e.getBoundingClientRect(); return r.width >= innerWidth - 1 && r.bottom >= innerHeight - 1; });
  ok("phone: Show working opens as a bottom sheet", sheet);
  await page.keyboard.press("Escape");
  const small = await page.$$eval("#s-map text, #s-map .l, #s-map td, #s-map .n", (e) => e.filter((x) => x.getClientRects().length && parseFloat(getComputedStyle(x).fontSize) < 11).length);
  ok("phone: no text under 11px on the map", small === 0, small);

  /* ---------- locking again ---------- */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.click("#lockBtn"); await page.waitForTimeout(600);
  ok("lock button forgets the device", await page.isVisible("#gate .note"));

  ok("no script errors", errors.length === 0, errors.join(" | "));
  const fails = R.filter((r) => r.startsWith("FAIL"));
  return R.join("\n") + "\n\n" + (R.length - fails.length) + " of " + R.length + " passed";
}
