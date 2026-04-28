from copy import deepcopy
from typing import Any, Dict, List

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
                    "stock": ["opening_stock", "closing_stock"],
                    "financial": ["rate", "value"],
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


def _safe_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (ValueError, TypeError):
        return 0.0


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


def _row_measure(row: Dict[str, Any]) -> float:
    return (
        _safe_float(row.get("amount"))
        or _safe_float(row.get("value"))
        or _safe_float(row.get("closing_balance"))
        or _safe_float(row.get("closing_stock"))
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
                    "quantity": _safe_float(voucher.get("quantity", 0)),
                    "unit": voucher.get("unit", ""),
                    "amount": _safe_float(voucher.get("amount")),
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
                "opening_balance": _safe_float(ledger.get("opening")),
                "closing_balance": _safe_float(ledger.get("closing")),
                "balance_difference": round(_safe_float(ledger.get("closing")) - _safe_float(ledger.get("opening")), 2),
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
        return [
            {
                "item_name": item.get("name", ""),
                "group": item.get("group", ""),
                "opening_stock": _safe_float(item.get("quantity")),
                "closing_stock": _safe_float(item.get("quantity")),
                "rate": _safe_float(item.get("rate")),
                "value": _safe_float(item.get("value")),
                "unit": item.get("unit", ""),
            }
            for item in items
        ]

    return []


def _apply_filters(rows: List[Dict[str, Any]], filters: Dict[str, str]) -> List[Dict[str, Any]]:
    search = (filters.get("search") or "").strip().lower()
    party_name = (filters.get("party_name") or "").strip().lower()
    item_name = (filters.get("item_name") or "").strip().lower()
    date_from = (filters.get("date_from") or "").strip()
    date_to = (filters.get("date_to") or "").strip()

    def _match(row: Dict[str, Any]) -> bool:
        if party_name and party_name not in str(row.get("party_name", row.get("ledger_name", ""))).lower():
            return False
        if item_name and item_name not in str(row.get("item_name", "")).lower():
            return False
        if date_from:
            row_date = str(row.get("date", ""))
            if row_date and row_date < date_from.replace("-", ""):
                return False
        if date_to:
            row_date = str(row.get("date", ""))
            if row_date and row_date > date_to.replace("-", ""):
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
        "quantity",
        "amount",
        "opening_stock",
        "closing_stock",
        "rate",
        "value",
        "opening_balance",
        "closing_balance",
    ]
    grouped: Dict[tuple, Dict[str, Any]] = {}
    for row in rows:
        key = tuple(row.get(field) for field in group_by)
        if key not in grouped:
            grouped[key] = {field: row.get(field) for field in group_by}
            for numeric in numeric_fields:
                grouped[key][numeric] = 0.0
            grouped[key]["_count"] = 0
        grouped[key]["_count"] += 1
        for numeric in numeric_fields:
            grouped[key][numeric] += _safe_float(row.get(numeric))
    return list(grouped.values())


def _apply_calculations(rows: List[Dict[str, Any]], calculations: List[str]) -> tuple[List[Dict[str, Any]], float]:
    if not rows:
        return rows, 0.0

    total_amount = round(sum(_row_measure(row) for row in rows), 2)
    for row in rows:
        if "total_amount" in calculations:
            row["total_amount"] = total_amount
        if "percentage" in calculations:
            measure = _row_measure(row)
            row["percentage"] = round((measure / total_amount) * 100, 2) if total_amount > 0 else 0.0
        if "balance_difference" in calculations:
            row["balance_difference"] = round(
                _safe_float(row.get("closing_balance")) - _safe_float(row.get("opening_balance")),
                2,
            )
    return rows, total_amount


def _available_fields_for(req: AnalyticsRequest) -> List[str]:
    if req.type == "transactions":
        return _flatten_field_categories(ANALYTICS_CONFIG["types"]["transactions"]["fields"])
    field_map = ANALYTICS_CONFIG["types"]["masters"]["fields_by_sub_type"].get(req.sub_type, {})
    return _flatten_field_categories(field_map)


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

    filtered_rows = [{key: row.get(key) for key in visible_columns} for row in rows]
    return {
        "type": req.type,
        "sub_type": req.sub_type,
        "columns": visible_columns,
        "available_fields": available_fields,
        "records": len(filtered_rows),
        "total_amount": total_amount,
        "applied_filters": {k: v for k, v in req.filters.items() if v},
        "group_by": req.group_by,
        "data": filtered_rows,
        "mode": "live",
        "message": "No records returned from Tally for this selection." if not filtered_rows and not fetch_error else "",
        "error": fetch_error,
    }
