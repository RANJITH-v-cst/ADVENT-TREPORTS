"""ADVENT TREPORTS — Tally ERP Dashboard Backend."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routes import auth, dashboard, admin

app = FastAPI(title="ADVENT TREPORTS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(admin.router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "ADVENT TREPORTS"}
