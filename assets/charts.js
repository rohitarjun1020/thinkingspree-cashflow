/* Thinking Spree · Cash — chart builders (plain SVG, no library).
   Rules (dataviz): one y-axis, 2px lines, dots r>=4.5 with a 2px surface ring, bars <=24px with a 4px rounded
   data-end, hairline grid, text in ink (never the series colour), every month a hit target carrying data-month
   so hovering one chart lights the same month everywhere. Solid dot = actual, ring dot = forecast. */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const reduced = () => root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function frame(host, h) {
    host.textContent = "";
    const w = Math.max(280, Math.round(host.clientWidth || 640));
    const s = el("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, "aria-hidden": "true", focusable: "false" }, host);
    return { s, w, h };
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function ticks(lo, hi, n) {
    if (lo === hi) { hi = lo + 1; }
    const step = niceStep((hi - lo) / n);
    const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step;
    const t = []; for (let v = min; v <= max + step / 2; v += step) t.push(Math.round(v * 100) / 100);
    return { min, max, t, step };
  }
  /* bar with a 4px rounded data-end, square at the baseline */
  function barPath(x, yBase, yEnd, w, r) {
    const up = yEnd <= yBase, hgt = Math.abs(yBase - yEnd); r = Math.min(r, hgt, w / 2);
    if (hgt < 0.5) return `M${x},${yBase}h${w}`;
    return up
      ? `M${x},${yBase}V${yEnd + r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd + r}V${yBase}Z`
      : `M${x},${yBase}V${yEnd - r}Q${x},${yEnd} ${x + r},${yEnd}H${x + w - r}Q${x + w},${yEnd} ${x + w},${yEnd - r}V${yBase}Z`;
  }
  function xLabels(n, w) { const k = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 74)))); const out = []; for (let i = 0; i < n; i += k) out.push(i); if (n - 1 - out[out.length - 1] >= k) out.push(n - 1); else if (out.length > 1) out[out.length - 1] = n - 1; else out.push(n - 1); return out; }
  function grid(s, t, y, x0, x1, fmt, phone) {
    const g = el("g", { class: "grid" }, s);
    t.t.forEach((v) => {
      el("line", { x1: x0, x2: x1, y1: y(v), y2: y(v), class: v === 0 ? "zero" : null }, g);
      el("text", { x: x0 - 8, y: y(v) + 4, "text-anchor": "end", class: "tick" }, s, fmt(v, phone));
    });
  }
  function hover(s, o) {
    if (!o.onLeave) return;
    s.addEventListener("pointerleave", () => o.onLeave());
  }
  /* spread end labels so they never collide */
  function spread(items, minGap, lo, hi) {
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < minGap) items[i].y = items[i - 1].y + minGap;
    const over = items.length ? items[items.length - 1].y - hi : 0;
    if (over > 0) { items.forEach((it) => (it.y -= over)); for (let i = items.length - 2; i >= 0; i--) if (items[i + 1].y - items[i].y < minGap) items[i].y = items[i + 1].y - minGap; }
    items.forEach((it) => (it.y = Math.max(lo, it.y)));
    return items;
  }
  function dot(g, cx, cy, fc, color, key, r) {
    return el("circle", { cx, cy, r: r || (fc ? 4.6 : 4.8), class: "pt", "data-month": key,
      style: fc ? `fill:var(--paper);stroke:${color};stroke-width:2.4` : `fill:${color};stroke:var(--paper);stroke-width:2` }, g);
  }
  function hits(s, keys, xAt, step, top, height, o, info) {
    const g = el("g", {}, s);
    keys.forEach((k, i) => {
      const r = el("rect", { class: "hit", x: xAt(i) - step / 2, y: top, width: step, height, "data-k": k }, g);
      const fire = (e) => o.onHover && o.onHover(k, e, info ? info(i) : null);
      r.addEventListener("pointerenter", fire); r.addEventListener("pointermove", fire); r.addEventListener("pointerdown", fire);
    });
  }
  function bands(s, keys, xAt, step, top, height) {
    const g = el("g", {}, s);
    keys.forEach((k, i) => el("rect", { class: "mcol", x: xAt(i) - step / 2, y: top, width: step, height, "data-month": k, fill: "transparent" }, g));
  }

  /* ---------- 1. Cash at each month-end (actual line + forecast ring dots, safety line, forecast wash) ---------- */
  function cash(host, o) {
    const phone = host.clientWidth < 560, H = phone ? 236 : 292;
    const { s, w, h } = frame(host, H);
    const P = o.points, n = P.length, upto = o.upto == null ? n - 1 : o.upto;
    const m = { l: phone ? 46 : 60, r: phone ? 12 : 96, t: 22, b: 28 };
    const vals = P.map((p) => p.value).concat([0, o.safety || 0]);
    const t = ticks(Math.min(...vals), Math.max(...vals), phone ? 4 : 5);
    const step = (w - m.l - m.r) / Math.max(1, n - 1);
    const x = (i) => m.l + i * step, y = (v) => m.t + ((t.max - v) * (h - m.t - m.b)) / (t.max - t.min);
    const fi = P.findIndex((p) => p.fc);
    if (fi > 0) {
      const x0 = x(fi) - step / 2;
      el("rect", { class: "fcz", x: x0, y: m.t - 14, width: w - x0 - (phone ? 0 : m.r - 18), height: h - m.b - m.t + 14 }, s);
      el("text", { x: x0 + 6, y: m.t - 3 }, s, phone ? "Plan" : "Plan (forecast)");
    }
    bands(s, P.map((p) => p.key), x, step, m.t, h - m.t - m.b);
    grid(s, t, y, m.l, w - m.r + (phone ? 0 : 10), o.fmt, phone);
    if (o.safety) {
      el("line", { class: "safe", x1: m.l, x2: w - m.r + (phone ? 0 : 10), y1: y(o.safety), y2: y(o.safety) }, s);
      if (!phone) el("text", { x: w - m.r + 16, y: y(o.safety) + 4 }, s, "Safety line");
    }
    xLabels(n, w - m.l - m.r).forEach((i) => el("text", { x: x(i), y: h - 8, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" }, s, P[i].label));
    const lastA = fi > 0 ? fi - 1 : n - 1;
    const aEnd = Math.min(upto, lastA);
    const dA = P.slice(0, aEnd + 1).map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(p.value).toFixed(1)).join("");
    const lines = el("g", {}, s);
    const aPath = el("path", { d: dA, fill: "none", style: "stroke:var(--in)", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, lines);
    if (fi > 0 && upto >= fi) {
      const dF = P.slice(lastA, upto + 1).map((p, j) => (j ? "L" : "M") + x(lastA + j).toFixed(1) + "," + y(p.value).toFixed(1)).join("");
      el("path", { d: dF, fill: "none", style: "stroke:var(--fc)", "stroke-width": 2, "stroke-dasharray": "6 5", "stroke-linecap": "round" }, lines);
    }
    if (o.draw && !reduced() && aEnd > 0) {
      /* marker draw-in: a soft marker stroke traces the exact line once, then fades; the exact line is visible throughout */
      const mk = el("path", { d: dA, class: "marker", style: "stroke:var(--in)", "stroke-width": 7 }, lines);
      const len = aPath.getTotalLength();
      mk.style.strokeDasharray = len; mk.style.strokeDashoffset = len;
      mk.getBoundingClientRect();
      mk.style.transition = "stroke-dashoffset 1.15s cubic-bezier(.3,.7,.2,1), opacity .6s ease 1.25s";
      mk.style.strokeDashoffset = 0; mk.style.opacity = 0;
    }
    const pts = el("g", {}, s);
    P.forEach((p, i) => { if (i <= upto) dot(pts, x(i), y(p.value), p.fc, p.fc ? "var(--fc)" : (o.dotColor ? o.dotColor(p) : "var(--in)"), p.key); });
    /* direct labels: last actual and last forecast only (the exact figures sit in the margin) */
    (o.labels || []).forEach((lb) => {
      if (lb.i > upto) return;
      const px = x(lb.i), py = y(P[lb.i].value), right = lb.i === n - 1 && !phone;
      el("text", { x: right ? px + 10 : px - 9, y: right ? py + 4 : py + (lb.below ? 20 : -12), "text-anchor": right ? "start" : "end", class: "lbl" }, s, lb.text);
    });
    hits(s, P.map((p) => p.key), x, step, m.t - 14, h - m.t - m.b + 14, o, (i) => P[i]);
    hover(s, o);
    return { x, y, step };
  }

  /* ---------- 2. Grouped columns (client in vs operating out) ---------- */
  function columns(host, o) {
    const phone = host.clientWidth < 560, H = phone ? 220 : 270;
    const { s, w, h } = frame(host, H);
    const G = o.groups, n = G.length, ns = o.series.length;
    const m = { l: phone ? 46 : 60, r: 8, t: 14, b: 28 };
    const t = ticks(0, Math.max(1, ...G.flatMap((g) => g.values)), phone ? 4 : 5);
    const step = (w - m.l - m.r) / n;
    const x = (i) => m.l + step * (i + 0.5), y = (v) => m.t + ((t.max - v) * (h - m.t - m.b)) / (t.max - t.min);
    bands(s, G.map((g) => g.key), x, step, m.t, h - m.t - m.b);
    grid(s, t, y, m.l, w - m.r, o.fmt, phone);
    const bw = Math.max(3, Math.min(24, (step - 6) / ns - 2));
    const g = el("g", {}, s);
    G.forEach((gr, i) => {
      gr.values.forEach((v, j) => {
        const bx = x(i) - (ns * bw + (ns - 1) * 2) / 2 + j * (bw + 2);
        el("path", { d: barPath(bx, y(0), y(v), bw, 4), "data-month": gr.key, class: "bar", style: `fill:${o.series[j].color}` }, g);
      });
    });
    xLabels(n, w - m.l - m.r).forEach((i) => el("text", { x: x(i), y: h - 8, "text-anchor": "middle" }, s, G[i].label));
    hits(s, G.map((g) => g.key), x, step, m.t, h - m.t - m.b, o, (i) => G[i]);
    hover(s, o);
  }

  /* ---------- 3. Multi-line (scenarios, what-if) ---------- */
  function lines(host, o) {
    const phone = host.clientWidth < 560, H = o.height || (phone ? 240 : 300);
    const { s, w, h } = frame(host, H);
    const K = o.keys, n = K.length;
    const showEnd = !phone && o.endLabels !== false;
    const m = { l: phone ? 46 : 60, r: showEnd ? (o.right || 190) : 14, t: 22, b: 28 };
    const all = (o.domain || []).concat(o.series.flatMap((se) => se.values.filter((v) => v != null))).concat([0]).concat(o.safety ? [o.safety] : []);
    const t = ticks(Math.min(...all), Math.max(...all), o.tickCount || (phone ? 4 : 5));
    const step = (w - m.l - m.r) / Math.max(1, n - 1);
    const x = (i) => m.l + i * step, y = (v) => m.t + ((t.max - v) * (h - m.t - m.b)) / (t.max - t.min);
    const fi = K.findIndex((k) => k.fc);
    if (fi > 0) {
      const x0 = x(fi) - step / 2;
      el("rect", { class: "fcz", x: x0, y: m.t - 14, width: x(n - 1) + Math.min(step / 2, 18) - x0, height: h - m.b - m.t + 14 }, s);
      if (o.fcLabel !== false) el("text", { x: x0 + 6, y: m.t - 3 }, s, "Forecast");
    }
    bands(s, K.map((k) => k.key), x, step, m.t, h - m.t - m.b);
    grid(s, t, y, m.l, x(n - 1) + 8, o.fmt, phone);
    if (o.safety) el("line", { class: "safe", x1: m.l, x2: x(n - 1) + 8, y1: y(o.safety), y2: y(o.safety) }, s);
    xLabels(n, w - m.l - m.r).forEach((i) => el("text", { x: x(i), y: h - 8, "text-anchor": i === 0 ? "start" : i === n - 1 && !showEnd ? "end" : "middle" }, s, K[i].label));
    const lg = el("g", {}, s), pg = el("g", {}, s), ends = [];
    o.series.forEach((se) => {
      let d = "", started = false;
      se.values.forEach((v, i) => { if (v == null) { started = false; return; } d += (started ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); started = true; });
      el("path", { d, fill: "none", style: `stroke:${se.color}`, "stroke-width": se.width || 2, "stroke-dasharray": se.dash || null, "stroke-linejoin": "round", "stroke-linecap": "round", "data-series": se.id }, lg);
      se.values.forEach((v, i) => { if (v != null && (se.dots !== false) && (i >= (se.dotFrom || 0))) dot(pg, x(i), y(v), K[i].fc, se.color, K[i].key); });
      const li = se.values.length - 1;
      if (showEnd && se.end !== false && se.values[li] != null) ends.push({ y: y(se.values[li]) + 4, text: se.endText || se.name, color: se.color });
    });
    spread(ends, 17, m.t, h - m.b).forEach((e) => {
      el("line", { x1: x(n - 1) + 10, x2: x(n - 1) + 22, y1: e.y - 4, y2: e.y - 4, style: `stroke:${e.color}`, "stroke-width": 2.5 }, s);
      el("text", { x: x(n - 1) + 28, y: e.y, class: "lbl" }, s, e.text);
    });
    hits(s, K.map((k) => k.key), x, step, m.t - 14, h - m.t - m.b + 14, o, (i) => K[i]);
    hover(s, o);
  }

  /* ---------- 4. Every week as a dot, months left to right, shaded by closing cash (sequential, 4 bins) ---------- */
  function weekDots(host, o) {
    const R = o.months, n = R.length, phone = host.clientWidth < 520;
    const maxW = Math.max(...R.map((r) => r.weeks.length));
    const gap = phone ? 15 : 19, H = 22 + maxW * gap + 30;
    const { s, w, h } = frame(host, H);
    const m = { l: 8, r: 8 };
    const step = (w - m.l - m.r) / n, x = (i) => m.l + step * (i + 0.5);
    const rad = Math.max(4.5, Math.min(7, step / 2 - 2));
    bands(s, R.map((r) => r.key), x, step, 6, maxW * gap + 18);
    const g = el("g", {}, s);
    R.forEach((r, i) => r.weeks.forEach((wk, j) => {
      const c = el("circle", { cx: x(i), cy: 20 + j * gap, r: rad, class: "pt", "data-month": r.key, style: `fill:${o.colors[wk.bin]};stroke:var(--paper);stroke-width:2` }, g);
      const hit = el("circle", { cx: x(i), cy: 20 + j * gap, r: Math.max(12, rad + 4), class: "hit" }, s);
      const fire = (e) => o.onHover && o.onHover(r.key, e, wk);
      hit.addEventListener("pointerenter", fire); hit.addEventListener("pointerdown", fire);
      void c;
    }));
    xLabels(n, w - 40).forEach((i) => el("text", { x: x(i), y: h - 8, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" }, s, R[i].label));
    hover(s, o);
  }

  /* ---------- 5. Budget vs actual: actual bars, budget as a tick; forecast months as outlined bars ---------- */
  function budget(host, o) {
    const phone = host.clientWidth < 520, H = phone ? 220 : 250;
    const { s, w, h } = frame(host, H);
    const I = o.items, n = I.length;
    const m = { l: phone ? 46 : 58, r: 8, t: 14, b: 28 };
    const t = ticks(0, Math.max(...I.map((i) => Math.max(i.actual || 0, i.budget || 0))), 4);
    const step = (w - m.l - m.r) / n;
    const x = (i) => m.l + step * (i + 0.5), y = (v) => m.t + ((t.max - v) * (h - m.t - m.b)) / (t.max - t.min);
    bands(s, I.map((i) => i.key), x, step, m.t, h - m.t - m.b);
    grid(s, t, y, m.l, w - m.r, o.fmt, phone);
    const bw = Math.max(6, Math.min(24, step - 8)), g = el("g", {}, s);
    I.forEach((it, i) => {
      if (it.actual != null) el("path", { d: barPath(x(i) - bw / 2, y(0), y(it.actual), bw, 4), "data-month": it.key, style: "fill:var(--ser-out)" }, g);
      else el("path", { d: barPath(x(i) - bw / 2 + 1.2, y(0), y(it.budget), bw - 2.4, 4), "data-month": it.key, style: "fill:var(--paper);stroke:var(--fc);stroke-width:2.2" }, g);
      if (it.budget != null && it.actual != null) el("line", { x1: x(i) - bw / 2 - 4, x2: x(i) + bw / 2 + 4, y1: y(it.budget), y2: y(it.budget), style: "stroke:var(--ink)", "stroke-width": 2.5, "stroke-linecap": "round" }, g);
    });
    xLabels(n, w - m.l - m.r).forEach((i) => el("text", { x: x(i), y: h - 8, "text-anchor": "middle" }, s, I[i].label));
    hits(s, I.map((i) => i.key), x, step, m.t, h - m.t - m.b, o, (i) => I[i]);
    hover(s, o);
  }

  /* ---------- 6. Horizontal bars (HTML, so each row is a keyboard-reachable button) ---------- */
  function hbars(host, items, o) {
    host.textContent = "";
    const max = Math.max(...items.map((i) => i.value), 1);
    items.forEach((it) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "hb " + (it.cls || ""); if (it.w) b.dataset.w = it.w;
      const nm = document.createElement("span"); nm.className = "nm"; nm.textContent = it.name; nm.title = it.full || it.name;
      const bar = document.createElement("span"); bar.className = "bar"; const i = document.createElement("i"); i.style.width = Math.max(0.4, (it.value / max) * 100) + "%"; bar.appendChild(i);
      const v = document.createElement("span"); v.className = "val"; v.textContent = it.text; if (it.sub) { const sm = document.createElement("small"); sm.textContent = it.sub; v.appendChild(sm); }
      b.append(nm, bar, v); b.setAttribute("aria-label", it.name + ", " + it.text + (it.sub ? ", " + it.sub : "") + ". Show working.");
      host.appendChild(b);
    });
    void o;
  }

  root.TSCharts = { cash, columns, lines, weekDots, budget, hbars, ticks };
})(window);
