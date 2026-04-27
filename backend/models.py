"""Pydantic models for API request/response schemas."""
from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str
    username: str


class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user"
    full_name: str = ""


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    full_name: str


class MessageResponse(BaseModel):
    message: str
