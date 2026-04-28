from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from routes.auth import get_current_user
import tally_client

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

DATASET_CONFIG: Dict[str, Dict[str, Any]] = {
    "transactions": {
        "label": "Transactions",
        "subtypes": ["sales", "purchase"],
        "fields": ["date", "party_name", "item_name", "quantity", "amount"],
    },
    "item_master": {
        "label": "Item Master",
        "subtypes": [],
        "fields": ["item_name", "opening_stock", "closing_stock", "rate", "value"],
    },
    "ledger_master": {
        "label": "Ledger Master",
        "subtypes": [],
        "fields": ["name", "address", "phone", "gst", "opening_balance", "closing_balance"],
    },
}

CALCULATION_FIELDS = {
    "balance_difference": "balance_difference",
    "percentage": "percentage",
    "total_amount": "total_amount",
}


class AnalyticsRequest(BaseModel):
    dataset: str = Field(..., description="transactions | item_master | ledger_master")
    transaction_type: str = Field("sales", description="sales | purchase")
    selected_columns: List[str] = Field(default_factory=list)
    calculations: List[str] = Field(default_factory=list)
    filters: Dict[str, str] = Field(default_factory=dict)


def _safe_float(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _apply_filters(rows: List[Dict[str, Any]], filters: Dict[str, str]) -> List[Dict[str, Any]]:
    party = (filters.get("party_name") or "").strip().lower()
    item = (filters.get("item_name") or "").strip().lower()
    query = (filters.get("search") or "").strip().lower()

    def matches(row: Dict[str, Any]) -> bool:
        if party and party not in str(row.get("party_name", "")).lower():
            return False
        if item and item not in str(row.get("item_name", "")).lower():
            return False
        if query:
            haystack = " ".join(str(v) for v in row.values()).lower()
            if query not in haystack:
                return False
        return True

    return [row for row in rows if matches(row)]


def _mock_transactions(transaction_type: str) -> List[Dict[str, Any]]:
    return [
        {
            "date": "20260401",
            "party_name": "A1 Traders",
            "item_name": "Steel Rod",
            "quantity": 25,
            "amount": 87500 if transaction_type == "sales" else 71200,
        },
        {
            "date": "20260402",
            "party_name": "Bright Metals",
            "item_name": "Copper Wire",
            "quantity": 14,
            "amount": 63400 if transaction_type == "sales" else 51200,
        },
    ]


def _mock_items() -> List[Dict[str, Any]]:
    return [
        {"item_name": "Steel Rod", "opening_stock": 120, "closing_stock": 95, "rate": 3500, "value": 332500},
        {"item_name": "Copper Wire", "opening_stock": 80, "closing_stock": 70, "rate": 4600, "value": 322000},
    ]


def _mock_ledgers() -> List[Dict[str, Any]]:
    return [
        {
            "name": "A1 Traders",
            "address": "Mumbai",
            "phone": "9999999999",
            "gst": "27ABCDE1234F1Z5",
            "opening_balance": 120000,
            "closing_balance": 98000,
        },
        {
            "name": "Bright Metals",
            "address": "Pune",
            "phone": "8888888888",
            "gst": "27FGHIJ5678K1Z2",
            "opening_balance": 87000,
            "closing_balance": 103000,
        },
    ]


async def _fetch_dataset_rows(req: AnalyticsRequest) -> List[Dict[str, Any]]:
    if req.dataset == "transactions":
        daybook = await tally_client.get_daybook(
            req.filters.get("date_from", ""),
            req.filters.get("date_to", ""),
        )
        tx_type = "purchase" if req.transaction_type == "purchase" else "sales"
        rows = []
        for row in daybook:
            voucher_type = str(row.get("type", "")).lower()
            if tx_type not in voucher_type:
                continue
            rows.append(
                {
                    "date": row.get("date", ""),
                    "party_name": row.get("party", ""),
                    "item_name": row.get("ledgers", ""),
                    "quantity": 1,
                    "amount": _safe_float(row.get("amount")),
                }
            )
        return rows

    if req.dataset == "item_master":
        stock_items = await tally_client.get_stock_items()
        return [
            {
                "item_name": item.get("name", ""),
                "opening_stock": _safe_float(item.get("quantity")),
                "closing_stock": _safe_float(item.get("quantity")),
                "rate": _safe_float(item.get("rate")),
                "value": _safe_float(item.get("value")),
            }
            for item in stock_items
        ]

    if req.dataset == "ledger_master":
        ledgers = await tally_client.get_ledgers()
        return [
            {
                "name": ledger.get("name", ""),
                "address": "",
                "phone": "",
                "gst": "",
                "opening_balance": _safe_float(ledger.get("opening")),
                "closing_balance": _safe_float(ledger.get("closing")),
            }
            for ledger in ledgers
        ]

    return []


def _apply_calculations(rows: List[Dict[str, Any]], calculations: List[str]) -> List[Dict[str, Any]]:
    if not rows:
        return rows

    total_amount = sum(_safe_float(row.get("amount")) for row in rows)
    for row in rows:
        if "balance_difference" in calculations:
            row["balance_difference"] = round(
                _safe_float(row.get("closing_balance")) - _safe_float(row.get("opening_balance")),
                2,
            )
        if "percentage" in calculations:
            amount = _safe_float(row.get("amount")) or _safe_float(row.get("value")) or _safe_float(row.get("closing_balance"))
            row["percentage"] = round((amount / total_amount) * 100, 2) if total_amount > 0 else 0.0
        if "total_amount" in calculations:
            row["total_amount"] = round(
                _safe_float(row.get("amount")) + _safe_float(row.get("value")) + _safe_float(row.get("closing_balance")),
                2,
            )
    return rows


@router.get("/config")
async def analytics_config(current_user=Depends(get_current_user)):
    return {"datasets": DATASET_CONFIG, "calculations": CALCULATION_FIELDS}


@router.post("")
@router.post("/")
@router.post("/run")
async def get_analytics(req: AnalyticsRequest, current_user=Depends(get_current_user)):
    if req.dataset not in DATASET_CONFIG:
        return {"data": [], "error": "Invalid dataset"}

    try:
        rows = await _fetch_dataset_rows(req)
    except Exception:
        if req.dataset == "transactions":
            rows = _mock_transactions(req.transaction_type)
        elif req.dataset == "item_master":
            rows = _mock_items()
        else:
            rows = _mock_ledgers()

    rows = _apply_filters(rows, req.filters)
    rows = _apply_calculations(rows, req.calculations)

    base_fields = DATASET_CONFIG[req.dataset]["fields"]
    selected = req.selected_columns or base_fields
    visible_columns = selected + [c for c in req.calculations if c in CALCULATION_FIELDS]
    ordered_cols: List[str] = []
    for col in visible_columns:
        if col not in ordered_cols:
            ordered_cols.append(col)

    result = [{col: row.get(col) for col in ordered_cols} for row in rows]

    return {
        "dataset": req.dataset,
        "transaction_type": req.transaction_type,
        "columns": ordered_cols,
        "records": len(result),
        "data": result,
        "mode": "live" if result else "mock",
    }
