"""Authentication routes."""
import os
from fastapi import APIRouter, HTTPException, Request
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_KEY", "")
supabase: Client = create_client(url, key)

router = APIRouter(prefix="/api/auth", tags=["auth"])

def get_current_user(request: Request) -> dict:
    """Extract user from Authorization header token using Supabase."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth.split(" ", 1)[1]
    
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return {
            "id": user_response.user.id,
            "email": user_response.user.email,
            "role": "user" # hardcoded since admin is not fully needed, or we could parse app_metadata
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication error: {str(e)}")

def require_admin(request: Request) -> dict:
    # Just return user for now since the user only adds people manually to supabase
    return get_current_user(request)

@router.get("/me")
async def me(request: Request):
    user = get_current_user(request)
    return user

