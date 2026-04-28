from fastapi import APIRouter, HTTPException, Request, Body
from routes.auth import get_current_user
import tally_client
import business_brain
import json

router = APIRouter(prefix="/api/business-brain", tags=["business-brain"])

async def _fetch_tally_data(company: str):
    sales_data = await tally_client.get_daybook("", "", company=company)
    # We filter sales and purchases for simplicity. In a real app we'd map this properly.
    sales = [{"date": v.get("date", ""), "amount": v.get("amount", 0)} for v in sales_data if v.get("voucher_type", "").lower() == "sales"]
    purchases = [{"date": v.get("date", ""), "amount": v.get("amount", 0)} for v in sales_data if v.get("voucher_type", "").lower() == "purchase"]
    expenses = [{"date": v.get("date", ""), "amount": v.get("amount", 0)} for v in sales_data if v.get("voucher_type", "").lower() in ["payment", "journal"]]
    
    inventory_raw = await tally_client.get_stock_items(company=company)
    inventory = [{"item": i.get("name"), "quantity": i.get("closing_balance", 0), "turnover_rate": 2.0} for i in inventory_raw]
    
    # Mocking supplier and employee since Tally might not have structured APIs for these in our current wrapper
    supplier_data = [{"name": "Supplier A", "price": 100, "delivery_days": 2, "quality_score": 8},
                     {"name": "Supplier B", "price": 90, "delivery_days": 5, "quality_score": 6}]
    employee_data = [{"name": "Emp 1", "sales_generated": 50000}, {"name": "Emp 2", "sales_generated": 80000}]
    
    return sales, purchases, expenses, inventory, supplier_data, employee_data

@router.get("/analysis")
async def analysis(request: Request):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        sales, purchases, expenses, inventory, suppliers, employees = await _fetch_tally_data(company)
        result_json = business_brain.run_business_brain(sales, purchases, expenses, inventory, suppliers, employees)
        return json.loads(result_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/simulate")
async def simulate(request: Request, payload: dict = Body(...)):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    sales_change = payload.get("sales_change_pct", 0.0)
    purchase_change = payload.get("purchase_change_pct", 0.0)
    
    try:
        sales, purchases, expenses, _, _, _ = await _fetch_tally_data(company)
        sim_result = business_brain.simulate_changes(sales, purchases, expenses, float(sales_change), float(purchase_change))
        return sim_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/predict")
async def predict(request: Request):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        sales, purchases, expenses, _, _, _ = await _fetch_tally_data(company)
        pred_result = business_brain.predict_business(sales, purchases, expenses)
        return pred_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/suggestions")
async def suggestions(request: Request):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        sales, purchases, expenses, inventory, suppliers, employees = await _fetch_tally_data(company)
        result_json = business_brain.run_business_brain(sales, purchases, expenses, inventory, suppliers, employees)
        data = json.loads(result_json)
        return {"suggestions": data.get("suggestions", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
