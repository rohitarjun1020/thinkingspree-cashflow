"""Monthly refresh for the Thinking Spree cash flow dashboard.

Usage (from the project folder):
    python -I tools/refresh.py                 # newest "Cash Flow Forecast - Thinking Spree DDMMYYYY.xlsx"
    python -I tools/refresh.py "path\\to\\file.xlsx"

Reads the workbook (values only, never edits it), rebuilds every figure the
dashboard shows, runs the reconciliation checks, writes dashboard-data.js,
prints a check table and a change list, and rebuilds the private
"Ask Claude" page (outside this repo) from the same data.
"""
import datetime as dt
import glob
import json
import os
import re
import subprocess
import sys

import openpyxl
from openpyxl.utils import get_column_letter as COL

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, "dashboard-data.js")
SOURCE_ROOT = r"C:\Users\Rohit SRF\Strategy Studio Labs LLP\SRF Client Database - CFO Thinking Spree"
ASK_CLAUDE_DIR = r"C:\Users\Rohit SRF\Thinking Spree Ask the Data"
NAME_RE = re.compile(r"Cash Flow Forecast - Thinking Spree (\d{2})(\d{2})(\d{4})\.xlsx$", re.I)
TOL = 0.005  # half a paisa


def newest_workbook():
    best = None
    for p in glob.glob(os.path.join(SOURCE_ROOT, "**", "Cash Flow Forecast - Thinking Spree *.xlsx"), recursive=True):
        m = NAME_RE.search(os.path.basename(p))
        if not m or os.path.basename(p).startswith("~$"):
            continue
        d = dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if best is None or d > best[0]:
            best = (d, p)
    if not best:
        sys.exit("No 'Cash Flow Forecast - Thinking Spree DDMMYYYY.xlsx' found under " + SOURCE_ROOT)
    return best[1]


def num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else 0.0


def r2(v):
    return round(v + 0.0, 2)


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def fail(msg):
    sys.exit("REFRESH STOPPED: " + msg)


# ----------------------------------------------------------------------------- workbook
src = sys.argv[1] if len(sys.argv) > 1 else newest_workbook()
wb = openpyxl.load_workbook(src, data_only=True)
props = wb.properties
saved = (props.modified or dt.datetime.fromtimestamp(os.path.getmtime(src)))
ws = wb["Cash Flow Forecast"]
quirks = []  # plain-English notes about the workbook, shown on the Test page

# ---- rows by label
label_row = {}
for r in range(1, ws.max_row + 1):
    a = clean(ws.cell(r, 1).value)
    if a and a.lower() not in label_row:
        label_row[a.lower()] = r


def find_row(*names):
    for n in names:
        for k, r in label_row.items():
            if k.rstrip(":").strip() == n.lower():
                return r
    fail("row not found in Cash Flow Forecast: " + " / ".join(names))


R_OPEN = find_row("Opening Balance")
R_IN = find_row("Inflow")
R_OUT = find_row("Outflow")
R_CLOSE = find_row("Closing Balance")

# Inflow groups: header rows whose value is the sum of the rows below them
IN_GROUPS = [("clients", "Collections from Billed invoices"), ("bookings", "Collections From Confirmed Booking"),
             ("itr", "ITR - Refund"), ("other", "Other Reciepts")]
OUT_GROUPS = [("investment", "Investment Activities"), ("salaries", "Salaries(Employee & Consultants)"),
              ("payables", "Accounts Payable"), ("statutory", "Statutory Liability"),
              ("software", "Software Subscriptions"), ("professional", "Professional Charges and Marketing"),
              ("rent", "Rent"), ("marketing", "Advertising and Marketing"), ("otherexp", "Other Expenses")]
GROUP_NAMES = {"clients": "Client receipts", "bookings": "Confirmed bookings", "itr": "Income tax refund",
               "other": "Other receipts", "investment": "Investments (fixed deposit)", "salaries": "Salaries & consultants",
               "payables": "Accounts payable", "statutory": "Statutory dues (GST, TDS, PT)", "software": "Software subscriptions",
               "professional": "Professional fees", "rent": "Rent", "marketing": "Advertising & marketing", "otherexp": "Other expenses"}
# money that is not from clients / not operating spend (user decision 18 Nov 2026)
NONCLIENT_IN_ROWS_LABELS = {"itr - refund", "vani loan a/c", "sakshi loan a/c", "fixed deposit", "other income"}


def group_rows(groups, start, stop):
    heads = [(gid, find_row(lbl)) for gid, lbl in groups]
    heads.sort(key=lambda x: x[1])
    out = []
    for i, (gid, hr) in enumerate(heads):
        nxt = heads[i + 1][1] if i + 1 < len(heads) else stop
        kids = [r for r in range(hr + 1, nxt) if clean(ws.cell(r, 1).value)]
        out.append((gid, hr, kids))
    return out


in_groups = group_rows(IN_GROUPS, R_IN, R_OUT)
out_groups = group_rows(OUT_GROUPS, R_OUT, R_CLOSE)
# the client block's header formula sums its rows down to the one before "Collections From Confirmed Booking"
lines = []
for direction, groups in (("in", in_groups), ("out", out_groups)):
    for gid, hr, kids in groups:
        rows = kids if kids else [hr]
        for r in rows:
            name = clean(ws.cell(r, 1).value)
            if name in ("", "0"):
                continue
            nonop = (direction == "in" and (gid != "clients" and gid != "bookings")) or (direction == "out" and gid == "investment")
            lines.append({"id": "r%d" % r, "row": r, "name": name, "dir": direction, "group": gid,
                          "client": direction == "in" and gid in ("clients", "bookings"), "nonop": nonop})
LINE_BY_ROW = {l["row"]: l for l in lines}
GROUP_ROW = {gid: hr for gid, hr, _ in in_groups + out_groups}

# ---- columns
weekly_cols, monthly_cols = [], []
for c in range(2, ws.max_column + 1):
    lab, d = ws.cell(4, c).value, ws.cell(5, c).value
    if isinstance(d, dt.datetime):
        if lab and re.search(r"\d", str(lab)):
            weekly_cols.append(c)
        else:
            monthly_cols.append(c)

# actuals run to the month-end of the last bank statement transaction
bs = wb["Bank Statement"]
bs_rows, stray = [], []
bs_open = None
for r in range(1, bs.max_row + 1):
    a, cdesc = bs.cell(r, 1).value, clean(bs.cell(r, 3).value)
    f, g = num(bs.cell(r, 6).value), num(bs.cell(r, 7).value)
    if cdesc.lower() == "opening balance":
        bs_open = num(bs.cell(r, 9).value)
    if isinstance(a, dt.datetime):
        bs_rows.append((a, f, g, num(bs.cell(r, 9).value), r))
    elif (f or g) and r > 3:
        stray.append({"row": r, "withdrawal": r2(f), "deposit": r2(g)})
if not bs_rows:
    fail("Bank Statement has no dated rows")
last_txn = max(x[0] for x in bs_rows)
actual_to = (dt.date(last_txn.year + (last_txn.month == 12), last_txn.month % 12 + 1, 1) - dt.timedelta(days=1))
bank = {"opening": r2(bs_open or 0), "deposits": r2(sum(x[2] for x in bs_rows)), "withdrawals": r2(sum(x[1] for x in bs_rows)),
        "lastTxn": last_txn.date().isoformat(), "lastBalance": r2(bs_rows[-1][3]), "rows": len(bs_rows), "stray": stray}
if stray:
    quirks.append({"id": "stray", "text": "The Bank Statement sheet has %d amount(s) below its last dated row (%s). They sit outside the statement and are left out." %
                   (len(stray), ", ".join("row %d ₹%s" % (s["row"], f"{s['deposit'] or s['withdrawal']:,.0f}") for s in stray))})


def parse_week(c):
    lab = str(ws.cell(4, c).value).strip()
    mdate = ws.cell(5, c).value
    nums = [int(x) for x in re.findall(r"\d+", lab)]
    if len(nums) < 4:
        fail("cannot read week label %r in column %s" % (lab, COL(c)))
    sd, sm, ed, em = nums[0], nums[1], nums[-2], nums[-1]
    y = mdate.year
    return lab, dt.date(y, sm, sd), dt.date(y, em, ed), mdate.date().replace(day=1)


weeks, skipped = [], []
prev_close = None
for c in weekly_cols:
    lab, start, end, month = parse_week(c)
    kind = str(ws.cell(3, c).value or "").strip()
    v = {}
    for l in lines:
        x = num(ws.cell(l["row"], c).value)
        if abs(x) > TOL:
            v[l["id"]] = r2(x)
    tin, tout = num(ws.cell(R_IN, c).value), num(ws.cell(R_OUT, c).value)
    if end > actual_to:
        if v or abs(tin) > TOL or abs(tout) > TOL:
            fail("week %s (%s) is after the last bank transaction but has figures; check the actuals boundary" % (lab, COL(c)))
        skipped.append({"col": COL(c), "label": lab, "kind": kind})
        continue
    s_open, s_close = ws.cell(R_OPEN, c).value, ws.cell(R_CLOSE, c).value
    opening = num(s_open) if prev_close is None else prev_close
    close = opening + tin - tout
    weeks.append({"i": len(weeks), "col": COL(c), "label": lab, "start": start.isoformat(), "end": end.isoformat(),
                  "month": month.strftime("%Y-%m"), "open": r2(opening), "inflow": r2(tin), "outflow": r2(tout),
                  "close": r2(close), "v": v,
                  "sheet": {"open": None if s_open is None else r2(num(s_open)), "close": r2(num(s_close))}})
    prev_close = close

broken = [w for w in weeks if w["sheet"]["open"] is None or abs(w["sheet"]["open"] - w["open"]) > TOL]
if broken:
    quirks.append({"id": "weekly-open", "text": "Weekly opening balances are blank in the sheet from %s (%s) onward, so the sheet's weekly closing balances from then are wrong (e.g. %s shows ₹%s). The dashboard carries each week's closing balance forward instead; month totals are unaffected." %
                   (broken[0]["label"], broken[0]["col"], broken[0]["label"], f"{broken[0]['sheet']['close']:,.2f}")})
if skipped:
    quirks.append({"id": "empty-weeks", "text": "%d week column(s) after %s are empty (%s), including the sheet's 'Projection' weeks. The forecast therefore comes from the Outflow Forecast sheet plus expected receivables." %
                   (len(skipped), actual_to.strftime("%d %b %Y"), ", ".join(s["label"] for s in skipped))})

# ---- months from weeks, compared with the sheet's monthly summary columns
msum = {ws.cell(5, c).value.date().strftime("%Y-%m"): c for c in monthly_cols}
months = []
for key in sorted({w["month"] for w in weeks}):
    ws_ = [w for w in weeks if w["month"] == key]
    v = {}
    for w in ws_:
        for k, x in w["v"].items():
            v[k] = r2(v.get(k, 0) + x)
    c = msum.get(key)
    sheet = None
    if c:
        sheet = {"col": COL(c), "open": r2(num(ws.cell(R_OPEN, c).value)), "inflow": r2(num(ws.cell(R_IN, c).value)),
                 "outflow": r2(num(ws.cell(R_OUT, c).value)), "close": r2(num(ws.cell(R_CLOSE, c).value))}
        gaps = []
        for l in lines:
            cell = ws.cell(l["row"], c).value
            if abs(num(cell) - v.get(l["id"], 0)) > TOL:
                gaps.append({"row": l["row"], "name": l["name"], "weekly": v.get(l["id"], 0), "sheet": None if cell is None else r2(num(cell))})
        sheet["lineGaps"] = gaps
    d = dt.date(int(key[:4]), int(key[5:]), 1)
    months.append({"key": key, "label": d.strftime("%b %Y"), "weeks": [w["i"] for w in ws_], "open": ws_[0]["open"],
                   "inflow": r2(sum(w["inflow"] for w in ws_)), "outflow": r2(sum(w["outflow"] for w in ws_)),
                   "close": ws_[-1]["close"], "v": v, "sheet": sheet})
gap_list = [(m["label"], g) for m in months if m["sheet"] for g in m["sheet"]["lineGaps"]]
if gap_list:
    quirks.append({"id": "monthly-cells", "text": "%d line cells are blank in the sheet's monthly summary although the weekly columns hold money (e.g. %s). The dashboard builds each month's lines from the weekly columns, which add up." %
                   (len(gap_list), "; ".join("%s %s ₹%s" % (lab, g["name"], f"{g['weekly']:,.0f}") for lab, g in gap_list[:3]))})

# ---- Bank Balance sheet (month-end balances as recorded)
bb = wb["Bank Balance"]
bank_bal = []
hdr = None
for r in range(1, bb.max_row + 1):
    if clean(bb.cell(r, 1).value).lower().startswith("balance as on"):
        hdr = r
if hdr:
    tot = next((r for r in range(hdr + 1, bb.max_row + 1) if clean(bb.cell(r, 1).value).lower() == "total"), None)
    for c in range(2, bb.max_column + 1):
        d = bb.cell(hdr, c).value
        if isinstance(d, str):
            mm = re.match(r"(\d{1,2})-(\d{1,2})-(\d{4})", d)
            d = None
            if mm:
                y_, m_, d_ = int(mm.group(3)), int(mm.group(2)), int(mm.group(1))
                last = (dt.date(y_ + (m_ == 12), m_ % 12 + 1, 1) - dt.timedelta(days=1)).day
                if d_ > last:
                    quirks.append({"id": "bank-date-%s" % COL(c), "text": "The Bank Balance sheet header in column %s reads '%s', a date that does not exist; it is read as %d %s." % (COL(c), bb.cell(hdr, c).value, last, dt.date(y_, m_, 1).strftime("%b %Y"))})
                    d_ = last
                d = dt.datetime(y_, m_, d_)
        if isinstance(d, dt.datetime) and tot:
            bank_bal.append({"date": d.date().isoformat(), "col": COL(c), "value": r2(num(bb.cell(tot, c).value))})

# ---- Outflow Forecast (budget)
of = wb["Outflow Forecast"]
of_hdr = next(r for r in range(1, 10) if clean(of.cell(r, 1).value).lower() == "outflow forecast")
of_cols = [(c, of.cell(of_hdr, c).value.date().strftime("%Y-%m")) for c in range(2, of.max_column + 1) if isinstance(of.cell(of_hdr, c).value, dt.datetime)]
remark_col = next((c for c in range(2, of.max_column + 1) if clean(of.cell(of_hdr, c).value).lower() == "remarks"), None)
budget_lines, of_total_row, section = [], None, None
for r in range(of_hdr + 1, of.max_row + 1):
    name = clean(of.cell(r, 1).value).lstrip("\ufffd").strip()
    if not name:
        continue
    if name.lower() == "total":
        of_total_row = r
        break
    vals = {k: r2(num(of.cell(r, c).value)) for c, k in of_cols}
    has_vals = any(of.cell(r, c).value is not None for c, _ in of_cols)
    if not has_vals:
        section = name
        continue
    budget_lines.append({"row": r, "name": name, "section": section, "v": vals,
                         "remark": clean(of.cell(r, remark_col).value) if remark_col else ""})
budget = {"months": [k for _, k in of_cols], "lines": budget_lines,
          "sheetTotal": {k: r2(num(of.cell(of_total_row, c).value)) for c, k in of_cols} if of_total_row else {},
          "totalRow": of_total_row}
bt_gap = {k: r2(sum(l["v"][k] for l in budget_lines) - budget["sheetTotal"].get(k, 0)) for k in budget["months"]}
fc_months = [k for k in budget["months"] if k > actual_to.strftime("%Y-%m")]
if fc_months and any(abs(bt_gap[k]) > TOL for k in fc_months):
    left = [l for l in budget_lines if any(abs(l["v"][k]) > TOL for k in fc_months)]
    k0 = fc_months[0]
    quirks.append({"id": "budget-total", "text": "The Outflow Forecast 'Total' row (row %d) leaves out some of its own lines: for %s its lines add to ₹%s but the total says ₹%s (gap ₹%s, the GST and TDS rows). The forecast uses the full lines, so totals equal the sum of their lines." %
                   (of_total_row, dt.date(int(k0[:4]), int(k0[5:]), 1).strftime("%b %Y"), f"{sum(l['v'][k0] for l in left):,.0f}", f"{budget['sheetTotal'][k0]:,.0f}", f"{bt_gap[k0]:,.0f}")})

# ---- AR Outstanding
ar_ws = wb["AR Outstanding"]
ar, ar_hdr = [], None
for r in range(1, ar_ws.max_row + 1):
    for c in range(1, ar_ws.max_column + 1):
        if clean(ar_ws.cell(r, c).value).lower() == "invoice date":
            ar_hdr = (r, c)
            break
    if ar_hdr:
        break
if ar_hdr:
    hr, hc = ar_hdr
    heads = {clean(ar_ws.cell(hr, c).value).lower(): c for c in range(hc, ar_ws.max_column + 1)}
    for r in range(hr + 1, ar_ws.max_row + 1):
        d = ar_ws.cell(r, hc).value
        if not isinstance(d, dt.datetime):
            break
        g = lambda k: ar_ws.cell(r, heads[k]).value if k in heads else None
        exp = g("expected collction date") or g("expected collection date")
        due = g("due date")
        ar.append({"row": r, "invoiceDate": d.date().isoformat(), "customer": clean(g("customer name")), "invoice": clean(g("invoice no")),
                   "amount": r2(num(g("amount"))), "daysOverdue": int(num(g("overdue"))), "due": due.date().isoformat() if isinstance(due, dt.datetime) else None,
                   "expected": exp.date().isoformat() if isinstance(exp, dt.datetime) else None, "status": clean(g("remarks"))})
ar_total = r2(num(ar_ws["F1"].value)) if clean(ar_ws["E1"].value).lower() == "total receivables" else None
ar_today_based = False
if ar_hdr:
    wbf = openpyxl.load_workbook(src, data_only=False)
    fws = wbf["AR Outstanding"]
    ar_today_based = any("TODAY()" in str(fws.cell(a["row"], c).value).upper() for a in ar for c in range(1, fws.max_column + 1))
if ar and ar_today_based:
    quirks.append({"id": "ar-today", "text": "In AR Outstanding, 'Overdue' days and 'Expected Collection date' are TODAY()-based formulas: overdue counts from the invoice date, and an overdue invoice is always expected 30 days after the day the file is opened. The dashboard uses the values as saved on %s (expected %s), labels them forecast, and treats them as an assumption, not a promise." %
                   (saved.strftime("%d %b %Y"), ", ".join(sorted({dt.date.fromisoformat(a["expected"]).strftime("%d %b %Y") for a in ar if a["expected"]})))})

# ---- Advances Summary
adv_ws = wb["Advances Summary"]
advances = []
for r in range(1, 40):
    if clean(adv_ws.cell(r, 1).value).lower() == "client":
        for rr in range(r + 1, r + 30):
            n = clean(adv_ws.cell(rr, 1).value)
            if not n or n.lower() == "total":
                break
            d = adv_ws.cell(rr, 2).value
            advances.append({"row": rr, "client": n, "received": d.date().isoformat() if isinstance(d, dt.datetime) else None,
                             "amount": r2(num(adv_ws.cell(rr, 3).value)), "sessionsDone": int(num(adv_ws.cell(rr, 4).value)),
                             "delivered": r2(num(adv_ws.cell(rr, 5).value)), "balance": r2(num(adv_ws.cell(rr, 6).value)),
                             "sessionsLeft": int(num(adv_ws.cell(rr, 10).value)), "status": clean(adv_ws.cell(rr, 12).value)})
        break

# ---- Bad debts
bd_ws = wb["Bad Debts"]
bad_debts = []
for r in range(1, bd_ws.max_row + 1):
    d = bd_ws.cell(r, 2).value
    if isinstance(d, dt.datetime):
        bad_debts.append({"row": r, "date": d.date().isoformat(), "customer": clean(bd_ws.cell(r, 3).value), "invoice": clean(bd_ws.cell(r, 4).value), "amount": r2(num(bd_ws.cell(r, 5).value))})

# ----------------------------------------------------------------------------- checks (python side)
checks = []


def check(cid, name, ok, detail):
    checks.append({"id": cid, "name": name, "ok": bool(ok), "detail": detail})


bad_w = [w["label"] for w in weeks if abs(w["open"] + w["inflow"] - w["outflow"] - w["close"]) > TOL]
check("week-identity", "Every week: opening + in − out = closing", not bad_w, "%d of %d weeks" % (len(weeks) - len(bad_w), len(weeks)))
bad_lines = []
for w in weeks:
    for direction, tot in (("in", w["inflow"]), ("out", w["outflow"])):
        s = sum(x for k, x in w["v"].items() if LINE_BY_ROW[int(k[1:])]["dir"] == direction)
        if abs(s - tot) > TOL:
            bad_lines.append("%s %s" % (w["label"], direction))
check("week-lines", "Every week: lines add up to the In and Out totals", not bad_lines, "%d of %d weeks" % (len(weeks) - len(bad_lines) // 1, len(weeks)) if not bad_lines else ", ".join(bad_lines[:5]))
bad_m = [m["label"] for m in months if m["sheet"] and any(abs(m[k] - m["sheet"][k]) > TOL for k in ("open", "inflow", "outflow", "close"))]
check("month-sheet", "Monthly totals equal the sheet's monthly summary", not bad_m, "%d of %d months" % (len(months) - len(bad_m), len(months)) if not bad_m else ", ".join(bad_m))
tin, tout = sum(w["inflow"] for w in weeks), sum(w["outflow"] for w in weeks)
check("bank-in", "All money in equals HDFC statement deposits", abs(tin - bank["deposits"]) <= TOL, "₹%s vs ₹%s" % (f"{tin:,.2f}", f"{bank['deposits']:,.2f}"))
check("bank-out", "All money out equals HDFC statement withdrawals", abs(tout - bank["withdrawals"]) <= TOL, "₹%s vs ₹%s" % (f"{tout:,.2f}", f"{bank['withdrawals']:,.2f}"))
check("bank-close", "Latest closing equals the statement's last running balance", abs(weeks[-1]["close"] - bank["lastBalance"]) <= TOL, "₹%s vs ₹%s" % (f"{weeks[-1]['close']:,.2f}", f"{bank['lastBalance']:,.2f}"))
check("bank-open", "First opening equals the statement's opening balance", abs(weeks[0]["open"] - bank["opening"]) <= TOL, "₹%s" % f"{bank['opening']:,.2f}")
mism = []
for b in bank_bal:
    m = next((m for m in months if m["key"] == b["date"][:7]), None)
    if m and abs(m["close"] - b["value"]) > TOL:
        wk = next((w for w in weeks if abs(w["close"] - b["value"]) <= TOL and w["month"] == m["key"]), None)
        mism.append({"month": m["label"], "sheet": b["value"], "monthEnd": m["close"], "matchesWeek": wk["label"] if wk else None, "col": b["col"]})
if mism:
    quirks.append({"id": "bank-balance-sheet", "text": "The Bank Balance sheet does not hold the month-end balance for %s. %s" %
                   (", ".join(x["month"] for x in mism), " ".join("%s shows ₹%s%s; month-end is ₹%s." % (x["month"], f"{x['sheet']:,.2f}", (" (the balance after week " + x["matchesWeek"] + ")") if x["matchesWeek"] else "", f"{x['monthEnd']:,.2f}") for x in mism))})

# ----------------------------------------------------------------------------- previous file (for "what changed")
prev = None
if os.path.exists(OUT):
    try:
        raw = open(OUT, encoding="utf-8").read().strip()
        old = json.loads(raw[raw.index("=") + 1:].rstrip(";"))
        if old["meta"]["source"] != os.path.basename(src):
            prev = {"source": old["meta"]["source"], "actualTo": old["meta"]["actualTo"],
                    "close": old["months"][-1]["close"], "ar": {a["invoice"]: a for a in old.get("ar", [])},
                    "months": {m["key"]: {"inflow": m["inflow"], "outflow": m["outflow"], "close": m["close"]} for m in old["months"]}}
        else:
            prev = old.get("prev")
    except Exception as e:  # noqa
        print("note: could not read the previous data file:", e)

data = {
    "meta": {"company": clean(ws.cell(1, 1).value), "source": os.path.basename(src), "saved": saved.strftime("%Y-%m-%d %H:%M"),
             "savedBy": props.lastModifiedBy or "", "actualTo": actual_to.isoformat(), "generated": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
             "rows": {"open": R_OPEN, "inflow": R_IN, "outflow": R_OUT, "close": R_CLOSE}, "groupRows": GROUP_ROW,
             "groupNames": GROUP_NAMES, "sheet": "Cash Flow Forecast"},
    "lines": lines, "weeks": weeks, "months": months, "skippedWeeks": skipped,
    "budget": budget, "ar": ar, "arTotal": ar_total, "advances": advances, "badDebts": bad_debts,
    "bank": bank, "bankBalanceSheet": bank_bal, "checks": checks, "quirks": quirks, "prev": prev,
}
payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
open(OUT, "w", encoding="utf-8").write("window.TS_DATA=" + payload + ";\n")

# stamp the asset links in index.html so a browser never mixes a new data file with old code (or the reverse)
_idx = os.path.join(REPO, "index.html")
if os.path.exists(_idx):
    _stamp = dt.datetime.now().strftime("%Y%m%d%H%M")
    _html = open(_idx, encoding="utf-8").read()
    _html2 = re.sub(r'((?:dashboard-data\.js|assets/[a-z]+\.(?:js|css)))(?:\?v=[0-9]+)?"', r"\g<1>?v=" + _stamp + '"', _html)
    if _html2 != _html:
        open(_idx, "w", encoding="utf-8", newline="\n").write(_html2)

# ----------------------------------------------------------------------------- report
print("Source :", src)
print("Saved  :", data["meta"]["saved"], "by", data["meta"]["savedBy"])
print("Actuals: %s to %s · %d weeks · %d months" % (weeks[0]["start"], actual_to, len(weeks), len(months)))
print("\nChecks")
for c in checks:
    print("  %s  %-58s %s" % ("PASS" if c["ok"] else "FAIL", c["name"], c["detail"]))
print("\nWorkbook notes (shown on the Test page)")
for q in quirks:
    print("  -", q["text"])
lm = months[-1]
print("\nCheck table (latest month, %s)" % lm["label"])
for k, r in (("open", R_OPEN), ("inflow", R_IN), ("outflow", R_OUT), ("close", R_CLOSE)):
    sv = lm["sheet"][k] if lm["sheet"] else None
    print("  %-8s dashboard ₹%15s   sheet %s%d ₹%15s   %s" % (k, f"{lm[k]:,.2f}", lm["sheet"]["col"] if lm["sheet"] else "-", r,
                                                        f"{sv:,.2f}" if sv is not None else "-", "match" if sv is not None and abs(sv - lm[k]) <= TOL else "CHECK"))
if prev and prev.get("months"):
    print("\nChanged since", prev["source"])
    for m in months:
        o = prev["months"].get(m["key"])
        if not o:
            print("  new month", m["label"], "close ₹%s" % f"{m['close']:,.2f}")
        elif any(abs(o[k] - m[k]) > TOL for k in ("inflow", "outflow", "close")):
            print("  %s: in %s→%s, out %s→%s" % (m["label"], f"{o['inflow']:,.0f}", f"{m['inflow']:,.0f}", f"{o['outflow']:,.0f}", f"{m['outflow']:,.0f}"))
if not all(c["ok"] for c in checks):
    print("\nWARNING: a check failed. Do not publish until it is explained.")
print("\nWrote", OUT, "(%d KB)" % (len(payload) // 1024))

build = os.path.join(ASK_CLAUDE_DIR, "build.py")
if os.path.exists(build):
    subprocess.run([sys.executable, "-I", build, OUT], check=False)
