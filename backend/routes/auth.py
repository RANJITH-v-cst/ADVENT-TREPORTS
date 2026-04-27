"""Authentication routes."""
import secrets
from fastapi import APIRouter, HTTPException, Depends, Request
from database import get_db, verify_password, hash_password
from models import LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_current_user(request: Request) -> dict:
    """Extract user from Authorization header token."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ", 1)[1]
    conn = get_db()
    row = conn.execute(
        "SELECT u.id, u.username, u.role, u.full_name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ?",
        (token,),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {"id": row["id"], "username": row["username"], "role": row["role"], "full_name": row["full_name"]}


def require_admin(request: Request) -> dict:
    user = get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    conn = get_db()
    row = conn.execute("SELECT * FROM users WHERE username = ?", (body.username,)).fetchone()
    if not row or not verify_password(body.password, row["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = secrets.token_urlsafe(48)
    conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, row["id"]))
    conn.commit()
    conn.close()
    return LoginResponse(
        access_token=token,
        role=row["role"],
        full_name=row["full_name"],
        username=row["username"],
    )


@router.get("/me", response_model=UserOut)
async def me(request: Request):
    user = get_current_user(request)
    return UserOut(**user)


@router.post("/logout")
async def logout(request: Request):
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split(" ", 1)[1]
        conn = get_db()
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
    return {"message": "Logged out"}
