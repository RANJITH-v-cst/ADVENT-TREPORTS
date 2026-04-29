from copy import deepcopy
from typing import Any, Dict, List
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from routes.auth import get_current_user
import tally_client

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

ANALYTICS_CONFIG: Dict[str, Any] = {
    "types": {
        "transactions": {
            "label": "Transactions",
            "sub_types": {
                "sales": {"label": "Sales"},
                "purchase": {"label": "Purchase"},
            },
            "fields": {
                "basic_info": ["date", "month", "year", "party_name", "item_name", "voucher_type", "voucher_number"],
                "stock": ["quantity", "unit"],
                "financial": ["amount"],
                "details": ["ledgers", "narration"],
            },
            "suggested_columns": ["date", "party_name", "amount"],
            "group_by_candidates": ["party_name", "item_name", "date"],
        },
        "masters": {
            "label": "Masters",
            "sub_types": {
                "ledger_master": {"label": "Ledger Master"},
                "item_master": {"label": "Item Master"},
                "sundry_debtors": {"label": "Sundry Debtors"},
                "sundry_creditors": {"label": "Sundry Creditors"},
            },
            "fields_by_sub_type": {
                "ledger_master": {
                    "basic_info": ["ledger_name", "parent", "address", "phone", "gst"],
                    "financial": ["opening_balance", "closing_balance", "balance_difference"],
                },
                "sundry_debtors": {
                    "basic_info": ["ledger_name", "parent", "address", "phone", "gst"],
                    "financial": ["opening_balance", "closing_balance", "balance_difference"],
                },
                "sundry_creditors": {
                    "basic_info": ["ledger_name", "parent", "address", "phone", "gst"],
                    "financial": ["opening_balance", "closing_balance", "balance_difference"],
                },
                "item_master": {
                    "basic_info": ["item_name", "group"],
                    "stock": ["opening_stock", "purchase_qty", "sales_qty", "closing_stock"],
                    "financial": ["opening_value", "purchase_value", "sales_value", "value", "rate", "purchase_rate", "sales_rate", "profit"],
                    "details": ["unit"],
                },
            },
            "suggested_columns": {
                "ledger_master": ["ledger_name", "closing_balance"],
                "sundry_debtors": ["ledger_name", "closing_balance", "balance_difference"],
                "sundry_creditors": ["ledger_name", "closing_balance", "balance_difference"],
                "item_master": ["item_name", "closing_stock", "value"],
            },
            "group_by_candidates": {
                "ledger_master": ["ledger_name", "gst"],
                "sundry_debtors": ["ledger_name", "gst"],
                "sundry_creditors": ["ledger_name", "gst"],
                "item_master": ["item_name"],
            },
        },
    },
    "calculations": {
        "balance_difference": "closing_balance - opening_balance",
        "percentage": "(row_amount / total_amount) * 100",
        "total_amount": "sum(amount)",
    },
}


class AnalyticsRequest(BaseModel):
    type: str = Field("transactions", description="transactions | masters")
    sub_type: str = Field("sales", description="sales | purchase | ledger_master | item_master | sundry_debtors | sundry_creditors")
    columns: List[str] = Field(default_factory=list)
    filters: Dict[str, str] = Field(default_factory=dict)
    calculations: List[str] = Field(default_factory=list)
    group_by: List[str] = Field(default_factory=list)
    # backward compatibility
    dataset: str | None = None
    transaction_type: str | None = None
    selected_columns: List[str] | None = None


# -----------------------------------
# HELPER FUNCTIONS FOR ACCURACY
# -----------------------------------

def _safe_decimal(value: Any) -> Decimal:
    """Safely converts any value to Decimal to avoid floating point inaccuracies."""
    if value is None or value == "":
        return Decimal("0.00")
    try:
        if isinstance(value, str):
            value = value.replace(",", "").strip()
        return Decimal(str(value))
    except (ValueError, TypeError, InvalidOperation):
        return Decimal("0.00")

def _norm_str(value: Any) -> str:
    """Normalizes string fields, providing safe fallbacks for UI."""
    if value is None:
        return "-"
    val_str = str(value).strip()
    return val_str if val_str else "-"

def _parse_tally_date(date_str: str) -> datetime | None:
    """Safely parses Tally dates (YYYYMMDD) into comparable datetime objects."""
    date_str = str(date_str).strip()
    if len(date_str) == 8:
        try:
            return datetime.strptime(date_str, "%Y%m%d")
        except ValueError:
            pass
    return None

def _format_date(date_str: str) -> str:
    """Formats raw YYYYMMDD to clean YYYY-MM-DD for the frontend."""
    d = _parse_tally_date(date_str)
    return d.strftime("%Y-%m-%d") if d else "-"

def _format_currency(val: Decimal) -> str:
    """Rounds accurately to 2 decimal places and adds comma separation."""
    return f"{val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):,.2f}"

def _format_percentage(val: Decimal) -> str:
    """Formats percentage accurately to 2 decimal places."""
    return f"{val.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}%"


def _normalize_request(req: AnalyticsRequest) -> AnalyticsRequest:
    if req.dataset:
        if req.dataset == "transactions":
            req.type = "transactions"
            req.sub_type = req.transaction_type or "sales"
        elif req.dataset in ("ledger_master", "item_master"):
            req.type = "masters"
            req.sub_type = req.dataset
    if req.selected_columns is not None and not req.columns:
        req.columns = req.selected_columns
    return req


def _flatten_field_categories(field_map: Dict[str, List[str]]) -> List[str]:
    fields: List[str] = []
    for _, value in field_map.items():
        for field in value:
            if field not in fields:
                fields.append(field)
    return fields


def _default_columns(req: AnalyticsRequest) -> List[str]:
    if req.type == "transactions":
        return ANALYTICS_CONFIG["types"]["transactions"]["suggested_columns"]
    suggested = ANALYTICS_CONFIG["types"]["masters"]["suggested_columns"].get(req.sub_type, [])
    return suggested


def _row_measure(row: Dict[str, Any]) -> Decimal:
    return (
        _safe_decimal(row.get("amount"))
        or _safe_decimal(row.get("value"))
        or _safe_decimal(row.get("closing_balance"))
        or _safe_decimal(row.get("closing_stock"))
    )


async def _fetch_rows(req: AnalyticsRequest) -> List[Dict[str, Any]]:
    if req.type == "transactions":
        vouchers = await tally_client.get_daybook(
            req.filters.get("date_from", ""),
            req.filters.get("date_to", ""),
        )
        rows: List[Dict[str, Any]] = []
        for voucher in vouchers:
            voucher_type = str(voucher.get("type", "")).lower()
            if req.sub_type == "sales" and "sale" not in voucher_type:
                continue
            if req.sub_type == "purchase" and "purchase" not in voucher_type:
                continue
            rows.append(
                {
                    "date": voucher.get("date", ""),
                    "month": str(voucher.get("date", ""))[4:6] if voucher.get("date") else "",
                    "year": str(voucher.get("date", ""))[:4] if voucher.get("date") else "",
                    "party_name": voucher.get("party", ""),
                    "item_name": voucher.get("item_name", "") or voucher.get("ledgers", ""),
                    "voucher_type": voucher.get("type", ""),
                    "voucher_number": voucher.get("number", ""),
                    "quantity": _safe_decimal(voucher.get("quantity", 0)),
                    "unit": voucher.get("unit", ""),
                    "amount": _safe_decimal(voucher.get("amount")),
                    "ledgers": voucher.get("ledgers", ""),
                    "narration": voucher.get("narration", ""),
                }
            )
        return rows

    if req.sub_type in ("ledger_master", "sundry_debtors", "sundry_creditors"):
        ledgers = await tally_client.get_ledgers()
        rows = [
            {
                "ledger_name": ledger.get("name", "") or ledger.get("parent", ""),
                "parent": ledger.get("parent", ""),
                "address": ledger.get("address", ""),
                "phone": ledger.get("phone", ""),
                "gst": ledger.get("gst", ""),
                "opening_balance": _safe_decimal(ledger.get("opening")),
                "closing_balance": _safe_decimal(ledger.get("closing")),
                "balance_difference": _safe_decimal(ledger.get("closing")) - _safe_decimal(ledger.get("opening")),
            }
            for ledger in ledgers
        ]
        if req.sub_type == "sundry_debtors":
            return [row for row in rows if "sundry debtors" in str(row.get("parent", "")).lower()]
        if req.sub_type == "sundry_creditors":
            return [row for row in rows if "sundry creditors" in str(row.get("parent", "")).lower()]
        return rows

    if req.sub_type == "item_master":
        items = await tally_client.get_stock_items()
        rows = []
        for item in items:
            p_qty = _safe_decimal(item.get("inwards_qty"))
            s_qty = _safe_decimal(item.get("outwards_qty"))
            p_val = _safe_decimal(item.get("inwards_value"))
            s_val = _safe_decimal(item.get("outwards_value"))
            o_val = _safe_decimal(item.get("opening_value"))
            c_val = _safe_decimal(item.get("value"))
            
            p_rate = (p_val / p_qty) if p_qty > 0 else Decimal("0.00")
            s_rate = (s_val / s_qty) if s_qty > 0 else Decimal("0.00")
            profit = s_val - (o_val + p_val - c_val)

            rows.append({
                "item_name": item.get("name", ""),
                "group": item.get("group", ""),
                "opening_stock": _safe_decimal(item.get("opening_stock")),
                "closing_stock": _safe_decimal(item.get("closing_stock")),
                "purchase_qty": p_qty,
                "sales_qty": s_qty,
                "purchase_value": p_val,
                "sales_value": s_val,
                "purchase_rate": p_rate,
                "sales_rate": s_rate,
                "profit": profit,
                "opening_value": o_val,
                "rate": _safe_decimal(item.get("rate")),
                "value": c_val,
                "unit": item.get("unit", ""),
            })
        return rows

    return []


def _apply_filters(rows: List[Dict[str, Any]], filters: Dict[str, str]) -> List[Dict[str, Any]]:
    search = (filters.get("search") or "").strip().lower()
    party_name = (filters.get("party_name") or "").strip().lower()
    item_name = (filters.get("item_name") or "").strip().lower()
    
    date_from = _parse_tally_date(filters.get("date_from", "").replace("-", ""))
    date_to = _parse_tally_date(filters.get("date_to", "").replace("-", ""))

    def _match(row: Dict[str, Any]) -> bool:
        if party_name and party_name not in str(row.get("party_name", row.get("ledger_name", ""))).lower():
            return False
        if item_name and item_name not in str(row.get("item_name", "")).lower():
            return False
            
        row_date = _parse_tally_date(str(row.get("date", "")))
        if date_from and row_date and row_date < date_from:
            return False
        if date_to and row_date and row_date > date_to:
            return False
            
        if search:
            joined = " ".join(str(v) for v in row.values()).lower()
            if search not in joined:
                return False
        return True

    return [row for row in rows if _match(row)]


def _group_rows(rows: List[Dict[str, Any]], group_by: List[str]) -> List[Dict[str, Any]]:
    if not group_by:
        return rows

    numeric_fields = [
        "quantity", "amount", "opening_stock", "closing_stock", 
        "rate", "value", "opening_balance", "closing_balance",
        "purchase_qty", "sales_qty", "purchase_value", "sales_value",
        "purchase_rate", "sales_rate", "profit", "opening_value"
    ]
    grouped: Dict[tuple, Dict[str, Any]] = {}
    
    for row in rows:
        key = tuple(_norm_str(row.get(field)) for field in group_by)
        if key not in grouped:
            grouped[key] = {field: row.get(field) for field in group_by}
            for numeric in numeric_fields:
                grouped[key][numeric] = Decimal("0.00")
            grouped[key]["_count"] = 0
            
        grouped[key]["_count"] += 1
        for numeric in numeric_fields:
            if numeric in row:
                grouped[key][numeric] += _safe_decimal(row.get(numeric))
                
    # Recompute rates correctly for grouped data instead of summing them directly
    for g in grouped.values():
        if "purchase_value" in g and "purchase_qty" in g and g["purchase_qty"] > 0:
            g["purchase_rate"] = g["purchase_value"] / g["purchase_qty"]
        if "sales_value" in g and "sales_qty" in g and g["sales_qty"] > 0:
            g["sales_rate"] = g["sales_value"] / g["sales_qty"]
            
    return list(grouped.values())


def _apply_calculations(rows: List[Dict[str, Any]], calculations: List[str]) -> tuple[List[Dict[str, Any]], Decimal]:
    if not rows:
        return rows, Decimal("0.00")

    total_amount = sum((_row_measure(row) for row in rows), Decimal("0.00"))
    
    for row in rows:
        if "total_amount" in calculations:
            row["total_amount"] = total_amount
        if "percentage" in calculations:
            measure = _row_measure(row)
            row["percentage"] = (measure / total_amount) * 100 if total_amount > 0 else Decimal("0.00")
        if "balance_difference" in calculations:
            row["balance_difference"] = _safe_decimal(row.get("closing_balance")) - _safe_decimal(row.get("opening_balance"))
            
    return rows, total_amount


def _available_fields_for(req: AnalyticsRequest) -> List[str]:
    if req.type == "transactions":
        return _flatten_field_categories(ANALYTICS_CONFIG["types"]["transactions"]["fields"])
    field_map = ANALYTICS_CONFIG["types"]["masters"]["fields_by_sub_type"].get(req.sub_type, {})
    return _flatten_field_categories(field_map)


def _get_columns_meta(columns: List[str]) -> List[Dict[str, Any]]:
    meta = []
    currency_fields = {"amount", "value", "rate", "closing_balance", "opening_balance", "balance_difference", "total_amount", "purchase_value", "sales_value", "opening_value", "purchase_rate", "sales_rate", "profit"}
    number_fields = {"quantity", "opening_stock", "closing_stock", "purchase_qty", "sales_qty", "month", "year"}
    
    for col in columns:
        label = col.replace("_", " ").title()
        if col in currency_fields:
            meta.append({"key": col, "label": label, "type": "currency", "align": "right", "sortable": True})
        elif col in number_fields:
            meta.append({"key": col, "label": label, "type": "number", "align": "right", "sortable": True})
        elif col == "percentage":
            meta.append({"key": col, "label": label, "type": "percentage", "align": "right", "sortable": True})
        elif col == "date":
            meta.append({"key": col, "label": label, "type": "date", "align": "left", "sortable": True})
        else:
            meta.append({"key": col, "label": label, "type": "text", "align": "left", "sortable": True})
    return meta


@router.get("/config")
async def analytics_config(current_user=Depends(get_current_user)):
    return deepcopy(ANALYTICS_CONFIG)


@router.post("")
@router.post("/")
@router.post("/run")
async def get_analytics(req: AnalyticsRequest, current_user=Depends(get_current_user)):
    req = _normalize_request(req)
    if req.type not in ("transactions", "masters"):
        return {"data": [], "error": "Invalid type"}

    try:
        rows = await _fetch_rows(req)
        fetch_error = ""
    except Exception as exc:
        rows = []
        fetch_error = f"Tally fetch failed: {str(exc)}"

    rows = _apply_filters(rows, req.filters)
    raw_fields = list({key for row in rows for key in row.keys()})
    rows = _group_rows(rows, req.group_by)
    rows, total_amount = _apply_calculations(rows, req.calculations)

    available_fields = _available_fields_for(req)
    for field in raw_fields:
        if field not in available_fields:
            available_fields.append(field)
            
    selected_columns = req.columns or _default_columns(req)
    visible_columns: List[str] = []
    for column in selected_columns + [c for c in req.calculations if c in ANALYTICS_CONFIG["calculations"]]:
        if column not in visible_columns:
            visible_columns.append(column)

    # Output Formatting (UI Ready)
    columns_meta = _get_columns_meta(visible_columns)
    meta_dict = {m["key"]: m for m in columns_meta}
    
    clean_data = []
    totals = {k: Decimal("0.00") for k in visible_columns if meta_dict[k]["type"] in ("currency", "number")}
    
    for row in rows:
        clean_row = {}
        for col in visible_columns:
            val = row.get(col)
            m_type = meta_dict[col]["type"]
            
            if m_type == "currency":
                d_val = _safe_decimal(val)
                clean_row[col] = _format_currency(d_val)
                totals[col] += d_val
            elif m_type == "percentage":
                clean_row[col] = _format_percentage(_safe_decimal(val))
            elif m_type == "number":
                d_val = _safe_decimal(val)
                clean_row[col] = str(d_val.quantize(Decimal("1"))) if d_val == d_val.to_integral() else str(d_val)
                totals[col] += d_val
            elif m_type == "date":
                clean_row[col] = _format_date(val)
            else:
                clean_row[col] = _norm_str(val)
        clean_data.append(clean_row)

    formatted_totals = {}
    for col, val in totals.items():
        if meta_dict[col]["type"] == "currency":
            formatted_totals[col] = _format_currency(val)
        else:
            formatted_totals[col] = str(val.quantize(Decimal("1"))) if val == val.to_integral() else str(val)

    return {
        "type": req.type,
        "sub_type": req.sub_type,
        "columns": visible_columns,
        "columns_meta": columns_meta,
        "available_fields": available_fields,
        "records": len(clean_data),
        "total_amount": float(total_amount),
        "applied_filters": {k: v for k, v in req.filters.items() if v},
        "group_by": req.group_by,
        "data": clean_data,
        "totals": formatted_totals,
        "mode": "live",
        "message": "No records returned from Tally for this selection." if not clean_data and not fetch_error else "",
        "error": fetch_error,
    }
