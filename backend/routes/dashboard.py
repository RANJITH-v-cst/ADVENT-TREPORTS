"""Dashboard data routes — all Tally data endpoints."""
from fastapi import APIRouter, HTTPException, Request, Query
from routes.auth import get_current_user
import tally_client

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/companies")
async def companies(request: Request):
    get_current_user(request)
    try:
        data = await tally_client.get_loaded_companies()
        return {"companies": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tally connection failed: {str(e)}")


@router.get("/summary")
async def summary(request: Request):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        data = await tally_client.get_dashboard_summary(company=company)
        return data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tally error: {str(e)}")


@router.get("/monthly")
async def monthly(request: Request):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        data = await tally_client.get_monthly_data(company=company)
        return {"months": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tally error: {str(e)}")


@router.get("/ledgers")
async def ledgers(request: Request):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        data = await tally_client.get_ledgers(company=company)
        return {"ledgers": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tally error: {str(e)}")


@router.get("/stock")
async def stock(request: Request):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        data = await tally_client.get_stock_items(company=company)
        return {"items": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tally error: {str(e)}")


@router.get("/daybook")
async def daybook(request: Request, from_date: str = "", to_date: str = ""):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        data = await tally_client.get_daybook(from_date, to_date, company=company)
        return {"vouchers": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tally error: {str(e)}")



@router.get("/gst-report")
async def gst_report(request: Request):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        data = await tally_client.get_gst_report(company=company)
        return data
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tally error: {str(e)}")


@router.get("/tds-report")
async def tds_report(request: Request):
    get_current_user(request)
    company = request.headers.get("X-Company-Name", "")
    try:
        data = await tally_client.get_tds_report(company=company)
        return {"ledgers": data}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tally error: {str(e)}")
