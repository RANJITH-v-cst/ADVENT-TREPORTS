"""Admin routes — user management."""
from fastapi import APIRouter, HTTPException, Request
from routes.auth import require_admin
from database import get_db, hash_password
from models import UserCreate, UserOut, MessageResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(request: Request):
    require_admin(request)
    conn = get_db()
    rows = conn.execute("SELECT id, username, role, full_name FROM users ORDER BY id").fetchall()
    conn.close()
    return [UserOut(**dict(r)) for r in rows]


@router.post("/users", response_model=UserOut)
async def create_user(body: UserCreate, request: Request):
    require_admin(request)
    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)",
            (body.username, hash_password(body.password), body.role, body.full_name),
        )
        conn.commit()
        user_id = cursor.lastrowid
    except Exception:
        conn.close()
        raise HTTPException(status_code=409, detail="Username already exists")
    conn.close()
    return UserOut(id=user_id, username=body.username, role=body.role, full_name=body.full_name)


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(user_id: int, request: Request):
    admin = require_admin(request)
    if admin["id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return MessageResponse(message="User deleted")
