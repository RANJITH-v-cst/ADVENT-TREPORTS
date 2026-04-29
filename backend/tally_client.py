"""Tally ERP XML communication client."""
import re
import asyncio
import time
import httpx
import xmltodict

TALLY_URL = "http://localhost:9000"
CACHE = {}
CACHE_TTL = 60  # 60 seconds cache for all Tally queries


def clean_xml(text: str) -> str:
    """Strip invalid XML characters that Tally ERP 9 sometimes injects."""
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)

    def repl(m):
        val = m.group(1)
        code = int(val[1:], 16) if val.lower().startswith('x') else int(val)
        if code < 0x20 and code not in (0x9, 0xA, 0xD):
            return ''
        return m.group(0)

    text = re.sub(r'&#(x[0-9a-fA-F]+|\d+);', repl, text)
    return text


def tally_val(raw) -> str:
    """Extract plain string from Tally XML field (may be dict with @TYPE/#text)."""
    if raw is None:
        return ""
    if isinstance(raw, dict):
        return str(raw.get("#text", raw.get("$", "")))
    return str(raw)


def tally_float(raw) -> float:
    """Extract float from Tally value, handling (123) as negative."""
    s = tally_val(raw).replace(",", "").strip()
    if not s:
        return 0.0
    # Handle (123.45) as -123.45
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1].strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def _collection(name: str, type_name: str, fields: list, filter_str: str = "", company: str = "") -> str:
    fetch_list = "".join(f"<FETCH>{f}</FETCH>" for f in fields)
    filter_xml = f"<FILTER>{filter_str}</FILTER>" if filter_str else ""
    sv_company = f"<SVCOMPANY>{company}</SVCOMPANY>" if company else ""
    return f"""<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>{name}</ID></HEADER>
<BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>{sv_company}</STATICVARIABLES>
<TDL><TDLMESSAGE>
<COLLECTION NAME="{name}" ISINITIALIZE="Yes">
<TYPE>{type_name}</TYPE>
{fetch_list}
{filter_xml}
</COLLECTION>
</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>"""


import hashlib

async def fetch_tally(xml: str) -> dict:
    """Post XML to Tally and parse response."""
    cache_key = f"xml_{hashlib.md5(xml.encode()).hexdigest()}"
    if cache_key in CACHE:
        ts, val = CACHE[cache_key]
        if time.time() - ts < CACHE_TTL:
            return val

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            TALLY_URL,
            content=xml.encode("utf-8"),
            headers={"Content-Type": "application/xml"},
        )
        if resp.status_code != 200:
            raise Exception(f"Tally returned HTTP {resp.status_code}")
        cleaned = clean_xml(resp.text)
        try:
            val = xmltodict.parse(cleaned)
            CACHE[cache_key] = (time.time(), val)
            return val
        except Exception:
            raise Exception(f"Failed to parse Tally XML. Raw: {cleaned[:300]}")


async def get_loaded_companies() -> list:
    xml = _collection("DashLoadedCo", "Company", ["NAME", "STARTINGFROM", "BOOKSFROM", "STATENAME"])
    data = await fetch_tally(xml)
    env = data.get("ENVELOPE", data)
    body = env.get("BODY", {}).get("DATA", {}).get("COLLECTION", {})
    companies = body.get("COMPANY", [])
    if isinstance(companies, dict):
        companies = [companies]
    return [{"name": tally_val(c.get("NAME", c.get("@NAME", ""))),
             "from": tally_val(c.get("STARTINGFROM", "")),
             "state": tally_val(c.get("STATENAME", ""))} for c in companies]


async def get_ledger_groups(company: str = "") -> list:
    xml = _collection("DashGroups", "Group", ["NAME", "PARENT", "CLOSINGBALANCE"], company=company)
    data = await fetch_tally(xml)
    env = data.get("ENVELOPE", data)
    body = env.get("BODY", {}).get("DATA", {}).get("COLLECTION", {})
    groups = body.get("GROUP", [])
    if isinstance(groups, dict):
        groups = [groups]
    return [{"name": tally_val(g.get("NAME", "")),
             "parent": tally_val(g.get("PARENT", "")),
             "balance": tally_float(g.get("CLOSINGBALANCE", 0))} for g in groups]


async def get_ledgers(company: str = "") -> list:
    xml = _collection(
        "DashLedgers",
        "Ledger",
        [
            "NAME",
            "PARENT",
            "CLOSINGBALANCE",
            "OPENINGBALANCE",
            "MAILINGNAME",
            "LEDGERMOBILE",
            "PARTYGSTIN",
            "GSTIN",
            "ADDRESS",
        ],
        company=company,
    )
    data = await fetch_tally(xml)
    env = data.get("ENVELOPE", data)
    body = env.get("BODY", {}).get("DATA", {}).get("COLLECTION", {})
    ledgers = body.get("LEDGER", [])
    if isinstance(ledgers, dict):
        ledgers = [ledgers]
    result = []
    for l in ledgers:
        address_raw = l.get("ADDRESS", "")
        if isinstance(address_raw, list):
            address = ", ".join(tally_val(a) for a in address_raw if tally_val(a))
        else:
            address = tally_val(address_raw)
        result.append(
            {
                "name": tally_val(l.get("NAME", l.get("@NAME", l.get("MAILINGNAME", "")))),
                "parent": tally_val(l.get("PARENT", "")),
                "closing": tally_float(l.get("CLOSINGBALANCE", 0)),
                "opening": tally_float(l.get("OPENINGBALANCE", 0)),
                "address": address,
                "phone": tally_val(l.get("LEDGERMOBILE", l.get("PHONENUMBER", ""))),
                "gst": tally_val(l.get("PARTYGSTIN", l.get("GSTIN", ""))),
            }
        )
    return result


async def get_stock_items(company: str = "") -> list:
    xml = _collection("DashStock", "StockItem", ["NAME", "PARENT", "CLOSINGBALANCE", "CLOSINGVALUE", "CLOSINGRATE", "BASEUNITS", "OPENINGBALANCE", "OPENINGVALUE", "INWARDQUANTITY", "INWARDVALUE", "OUTWARDQUANTITY", "OUTWARDVALUE"], company=company)
    data = await fetch_tally(xml)
    env = data.get("ENVELOPE", data)
    body = env.get("BODY", {}).get("DATA", {}).get("COLLECTION", {})
    items = body.get("STOCKITEM", [])
    if isinstance(items, dict):
        items = [items]
    result = []
    
    def _parse_qty(raw):
        val = tally_val(raw)
        if not val: return 0.0
        nums = re.findall(r'[-+]?\d*\.?\d+', val)
        return float(nums[0]) if nums else 0.0

    for it in items:
        qty = _parse_qty(it.get("CLOSINGBALANCE", ""))
        opening_qty = _parse_qty(it.get("OPENINGBALANCE", ""))
        inward_qty = _parse_qty(it.get("INWARDQUANTITY", ""))
        outward_qty = _parse_qty(it.get("OUTWARDQUANTITY", ""))
        
        result.append({
            "name": tally_val(it.get("NAME", it.get("@NAME", ""))),
            "group": tally_val(it.get("PARENT", "")),
            "quantity": qty,
            "opening_stock": opening_qty,
            "closing_stock": qty,
            "inwards_qty": inward_qty,
            "outwards_qty": outward_qty,
            "inwards_value": tally_float(it.get("INWARDVALUE", 0)),
            "outwards_value": tally_float(it.get("OUTWARDVALUE", 0)),
            "value": tally_float(it.get("CLOSINGVALUE", 0)),
            "opening_value": tally_float(it.get("OPENINGVALUE", 0)),
            "rate": tally_float(it.get("CLOSINGRATE", 0)),
            "unit": tally_val(it.get("BASEUNITS", "")),
        })
    return result


async def get_daybook(from_date: str = "", to_date: str = "", company: str = "") -> list:
    """Get recent vouchers. Dates in YYYYMMDD format."""
    sv = "<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>"
    if company:
        sv += f"<SVCOMPANY>{company}</SVCOMPANY>"
    if from_date and to_date:
        sv += f"<SVFROMDATE>{from_date}</SVFROMDATE><SVTODATE>{to_date}</SVTODATE>"
    xml = f"""<ENVELOPE>
<HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Day Book</ID></HEADER>
<BODY><DESC><STATICVARIABLES>{sv}</STATICVARIABLES></DESC></BODY></ENVELOPE>"""
    data = await fetch_tally(xml)
    env = data.get("ENVELOPE", data)
    body_dict = env.get("BODY", {}) if isinstance(env, dict) else {}
    data_dict = body_dict.get("DATA", {}) if isinstance(body_dict, dict) else {}
    
    msg = data_dict.get("TALLYMESSAGE", []) if isinstance(data_dict, dict) else []
    if isinstance(msg, dict):
        msg = [msg]
        
    vouchers = []
    for m in msg:
        if isinstance(m, dict):
            v = m.get("VOUCHER")
            if v:
                if isinstance(v, list): vouchers.extend(v)
                else: vouchers.append(v)
                
    result = []
    for v in vouchers[:200]:  # Limit to 200 recent
        if not isinstance(v, dict):
            continue
        entries = v.get("ALLLEDGERENTRIES.LIST", v.get("LEDGERENTRIES.LIST", []))
        if isinstance(entries, dict):
            entries = [entries]
        elif not isinstance(entries, list):
            entries = []
            
        ledger_names = [tally_val(e.get("LEDGERNAME", "")) for e in entries[:3] if isinstance(e, dict)]
        amount = 0.0
        for e in entries:
            if not isinstance(e, dict): continue
            amt = tally_float(e.get("AMOUNT", 0))
            if amt > 0:
                amount = amt
                break
        if amount == 0 and entries:
            amount = abs(tally_float(entries[0].get("AMOUNT", 0)))

        inventory_entries = v.get("ALLINVENTORYENTRIES.LIST", v.get("INVENTORYENTRIES.LIST", []))
        if isinstance(inventory_entries, dict):
            inventory_entries = [inventory_entries]
        elif not isinstance(inventory_entries, list):
            inventory_entries = []

        item_name = ""
        quantity = 0.0
        unit = ""
        if inventory_entries:
            first_item = inventory_entries[0] if isinstance(inventory_entries[0], dict) else {}
            item_name = tally_val(first_item.get("STOCKITEMNAME", ""))
            qty_raw = tally_val(first_item.get("BILLEDQTY", first_item.get("ACTUALQTY", "")))
            if qty_raw:
                nums = re.findall(r'[-+]?\d*\.?\d+', qty_raw)
                quantity = float(nums[0]) if nums else 0.0
                qty_parts = qty_raw.split(" ", 1)
                unit = qty_parts[1].strip() if len(qty_parts) > 1 else ""

        result.append({
            "date": tally_val(v.get("DATE", "")),
            "type": tally_val(v.get("VOUCHERTYPENAME", "")),
            "number": tally_val(v.get("VOUCHERNUMBER", "")),
            "party": tally_val(v.get("PARTYLEDGERNAME", ledger_names[0] if ledger_names else "")),
            "ledgers": ", ".join(ledger_names),
            "item_name": item_name,
            "quantity": quantity,
            "unit": unit,
            "amount": amount,
            "narration": tally_val(v.get("NARRATION", "")),
        })
    return result


async def get_dashboard_summary(company: str = "") -> dict:
    """Aggregate accurate KPIs from ledger groups for the 10 reports."""
    # Parallel Fetch
    groups_task = get_ledger_groups(company=company)
    ledgers_task = get_ledgers(company=company)
    stock_task = get_stock_items(company=company)
    
    groups, ledgers, stock_items = await asyncio.gather(groups_task, ledgers_task, stock_task)

    metrics = {
        "sales": 0.0, "purchases": 0.0,
        "direct_incomes": 0.0, "direct_expenses": 0.0,
        "indirect_incomes": 0.0, "indirect_expenses": 0.0,
        "cash_in_hand": 0.0, "bank_accounts": 0.0,
        "sundry_debtors": 0.0, "sundry_creditors": 0.0,
        "duties_taxes": 0.0, "provisions": 0.0,
        "capital_account": 0.0, "loans_liability": 0.0,
        "closing_stock_value": sum(abs(item["value"]) for item in stock_items),
        "closing_stock_qty": sum(abs(item["quantity"]) for item in stock_items)
    }

    group_map = {
        "Sales Accounts": "sales", "Purchase Accounts": "purchases",
        "Direct Incomes": "direct_incomes", "Direct Expenses": "direct_expenses",
        "Indirect Incomes": "indirect_incomes", "Indirect Expenses": "indirect_expenses",
        "Cash-in-hand": "cash_in_hand", "Bank Accounts": "bank_accounts", "Bank OD A/c": "bank_accounts",
        "Sundry Debtors": "sundry_debtors", "Sundry Creditors": "sundry_creditors",
        "Duties & Taxes": "duties_taxes", "Provisions": "provisions",
        "Capital Account": "capital_account", "Secured Loans": "loans_liability", "Unsecured Loans": "loans_liability"
    }

    # Helper to recursively find root category
    def get_root_category(parent_name):
        if parent_name in group_map: return group_map[parent_name]
        for g in groups:
            if g["name"] == parent_name:
                if g["parent"] in group_map: return group_map[g["parent"]]
                return get_root_category(g["parent"])
        return None

    expense_breakdown = {}
    for l in ledgers:
        bal = abs(l["closing"])
        root_cat = get_root_category(l["parent"])
        if root_cat:
            metrics[root_cat] += bal
            
        if root_cat in ["direct_expenses", "indirect_expenses", "purchases"] and bal > 0:
            expense_breakdown[l["parent"]] = expense_breakdown.get(l["parent"], 0) + bal

    # Use group balances as fallback if ledger summing is incomplete
    for g in groups:
        root_cat = group_map.get(g["name"])
        if root_cat and metrics[root_cat] == 0:
            metrics[root_cat] = abs(g["balance"])

    gross_profit = (metrics["sales"] + metrics["direct_incomes"]) - (metrics["purchases"] + metrics["direct_expenses"])
    net_profit = gross_profit + metrics["indirect_incomes"] - metrics["indirect_expenses"]
    
    current_assets = metrics["cash_in_hand"] + metrics["bank_accounts"] + metrics["sundry_debtors"] + metrics["closing_stock_value"]
    current_liabilities = metrics["sundry_creditors"] + metrics["duties_taxes"] + metrics["provisions"]
    
    # Ratios
    inv_turnover = metrics["sales"] / metrics["closing_stock_value"] if metrics["closing_stock_value"] else 0
    debt_equity = metrics["loans_liability"] / metrics["capital_account"] if metrics["capital_account"] else 0
    rec_turnover_days = (metrics["sundry_debtors"] / metrics["sales"]) * 365 if metrics["sales"] else 0
    roi = (net_profit / metrics["capital_account"]) * 100 if metrics["capital_account"] else 0

    sorted_ledgers = sorted(ledgers, key=lambda x: abs(x["closing"]), reverse=True)
    top_ledgers = [{"name": l["name"], "group": l["parent"], "amount": abs(l["closing"])} for l in sorted_ledgers[:10] if l["closing"] != 0]

    res = {
        "trading": {
            "gross_profit": gross_profit, "net_profit": net_profit,
            "sales": metrics["sales"], "purchases": metrics["purchases"]
        },
        "cash_bank": { "cash": metrics["cash_in_hand"], "bank": metrics["bank_accounts"] },
        "assets_liabilities": { "assets": current_assets, "liabilities": current_liabilities },
        "inventory": { 
            "value": metrics["closing_stock_value"], "quantity": metrics["closing_stock_qty"],
            "inwards": metrics["purchases"], "outwards": metrics["sales"] 
        },
        "receivables": metrics["sundry_debtors"], "payables": metrics["sundry_creditors"],
        "ratios": {
            "inventory_turnover": round(inv_turnover, 2), "debt_equity": round(debt_equity, 2),
            "receivable_days": round(rec_turnover_days, 2), "roi_percent": round(roi, 2)
        },
        "cash_flow": { "inflow": metrics["sales"] + metrics["direct_incomes"], "outflow": metrics["purchases"] + metrics["direct_expenses"], "net": gross_profit },
        "gst": { 
            "gstr1": { "uncertain": 1, "ready": 0 },
            "gstr3b": { "uncertain": 1 },
            "recon_gstr1": { "uncertain": 1, "reconciled": 0, "unreconciled": 0 },
            "recon_gstr2a": { "uncertain": 0, "reconciled": 0, "unreconciled": 0 },
            "recon_gstr2b": { "uncertain": 0, "reconciled": 0, "unreconciled": 0 },
            "liability_itc": { "tax_liability": metrics["duties_taxes"], "itc": 0 }
        },
        "banking": { "recon_pending_books": 0, "recon_pending_banks": 0, "balance_as_per_bank": metrics["bank_accounts"] },
        "revenue": metrics["sales"] + metrics["direct_incomes"] + metrics["indirect_incomes"],
        "expenses": metrics["purchases"] + metrics["direct_expenses"] + metrics["indirect_expenses"],
        "profit": net_profit,
        "cash_bank_total": metrics["cash_in_hand"] + metrics["bank_accounts"],
        "top_ledgers": top_ledgers,
        "expense_breakdown": [{"name": k, "value": v} for k, v in expense_breakdown.items()],
    }
    return res


async def get_monthly_data(company: str = "") -> list:
    """Get monthly Sales and Purchase approximations from ledger data."""
    summary = await get_dashboard_summary(company=company)
    from datetime import date
    months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
    current_month = date.today().month
    fy_month = (current_month - 4) % 12
    result = []
    
    total_sales = summary["trading"]["sales"]
    total_purchases = summary["trading"]["purchases"]
    
    for i, m in enumerate(months):
        if i <= fy_month:
            factor = 1.0 / (fy_month + 1)
            result.append({
                "month": m,
                "sales": round(total_sales * factor, 2),
                "purchases": round(total_purchases * factor, 2)
            })
        else:
            result.append({"month": m, "sales": 0, "purchases": 0})
            
    # Normalize back to exact totals
    act_sales = sum(r["sales"] for r in result)
    act_purch = sum(r["purchases"] for r in result)
    if act_sales > 0:
        for r in result: r["sales"] = round(r["sales"] * (total_sales / act_sales), 2)
    if act_purch > 0:
        for r in result: r["purchases"] = round(r["purchases"] * (total_purchases / act_purch), 2)
        
    return result


async def get_gst_report(company: str = "") -> dict:
    """Extract GST summary by tax type from ledgers."""
    ledgers = await get_ledgers(company=company)
    gst_data = {"igst": 0.0, "cgst": 0.0, "sgst": 0.0, "cess": 0.0, "total": 0.0}
    
    for l in ledgers:
        name = l["name"].upper()
        bal = abs(l["closing"])
        if "IGST" in name: gst_data["igst"] += bal
        elif "CGST" in name: gst_data["cgst"] += bal
        elif "SGST" in name or "UTGST" in name: gst_data["sgst"] += bal
        elif "CESS" in name: gst_data["cess"] += bal
    
    gst_data["total"] = sum(v for k, v in gst_data.items() if k != "total")
    return gst_data


async def get_tds_report(company: str = "") -> list:
    """Extract TDS related ledger balances."""
    ledgers = await get_ledgers(company=company)
    tds_ledgers = []
    for l in ledgers:
        if "TDS" in l["name"].upper() or "TAX DEDUCTED" in l["parent"].upper():
            tds_ledgers.append({
                "name": l["name"],
                "parent": l["parent"],
                "balance": l["closing"]
            })
    return tds_ledgers
