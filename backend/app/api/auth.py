from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    preferred_language: str = "en"

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str = "USER"

@router.post("/register", response_model=TokenResponse)
async def register_user(req: UserRegisterRequest):
    return TokenResponse(
        access_token="mock_access_token_demo_123456789",
        user_id="user-demo-001",
        email=req.email,
        role="USER"
    )

@router.post("/login", response_model=TokenResponse)
async def login_user(req: UserLoginRequest):
    return TokenResponse(
        access_token="mock_access_token_demo_123456789",
        user_id="user-demo-001",
        email=req.email,
        role="USER"
    )

@router.get("/me")
async def get_me():
    return {
        "user_id": "user-demo-001",
        "email": "demo.passenger@skyguardian.ai",
        "role": "USER",
        "preferred_language": "en"
    }
