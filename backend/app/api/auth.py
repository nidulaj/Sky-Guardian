import uuid
import logging
from enum import Enum
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field, model_validator
from passlib.context import CryptContext
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Password hashing context (using Argon2)
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Bearer token security scheme
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

# User Roles
class UserRole(str, Enum):
    PASSENGER = "PASSENGER"
    ADMIN = "ADMIN"

# Schemas
class UserRegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50, example="Nidula")
    last_name: str = Field(..., min_length=1, max_length=50, example="Perera")
    email: EmailStr = Field(..., example="passenger@gmail.com")
    phone_number: str = Field(..., min_length=7, max_length=25, example="+94771234567")
    password: str = Field(..., min_length=6, description="Password must be at least 6 characters")
    confirm_password: str = Field(..., min_length=6, description="Must match password")
    preferred_language: str = Field(default="en", example="en")

    @model_validator(mode="after")
    def verify_passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Password and confirm password do not match.")
        return self

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserProfile(BaseModel):
    user_id: str
    email: str
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    role: UserRole
    preferred_language: str = "en"
    created_at: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    phone_number: Optional[str] = Field(None, min_length=7, max_length=25)
    preferred_language: Optional[str] = Field(None, example="en")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile

# Helper Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def get_supabase():
    from supabase import create_client
    return create_client(settings.clean_supabase_url, settings.SUPABASE_SERVICE_ROLE_KEY)

# Dependency: Get Current Authenticated User
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        role: str = payload.get("role")
        if user_id is None or email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Try fetching fresh user record from Supabase
    try:
        sb = get_supabase()
        res = sb.table("users").select("*").eq("id", user_id).execute()
        if res.data:
            user_data = res.data[0]
            if not user_data.get("is_active", True):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
            return {
                "user_id": user_data["id"],
                "email": user_data["email"],
                "first_name": user_data.get("first_name", ""),
                "last_name": user_data.get("last_name", ""),
                "phone_number": user_data.get("phone_number"),
                "role": user_data.get("role", "PASSENGER"),
                "preferred_language": user_data.get("preferred_language", "en")
            }
    except Exception as e:
        logger.warning(f"Could not reach Supabase for user lookup ({e}). Falling back to verified JWT claims.")

    # Fallback to verified JWT claims if Supabase lookup is unavailable
    return {
        "user_id": user_id,
        "email": email,
        "first_name": payload.get("first_name", ""),
        "last_name": payload.get("last_name", ""),
        "phone_number": payload.get("phone_number"),
        "role": role or "PASSENGER",
        "preferred_language": payload.get("preferred_language", "en")
    }

# Dependency: Get Optional User (Does not raise 401 if unauthenticated)
async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)) -> Optional[Dict[str, Any]]:
    if not credentials or not credentials.credentials:
        return None
    try:
        return await get_current_user(credentials)
    except Exception as e:
        logger.debug(f"Optional authentication skipped: {e}")
        return None

# Dependency: Require Role Guard
def require_role(*allowed_roles: UserRole):
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role")
        if user_role not in [r.value for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of the following roles: {[r.value for r in allowed_roles]}"
            )
        return current_user
    return role_checker

require_admin = require_role(UserRole.ADMIN)

# Endpoints
@router.post("/register", response_model=TokenResponse)
async def register_passenger(req: UserRegisterRequest):
    """
    Public registration endpoint strictly for PASSENGER accounts.
    Requires first name, last name, email, phone number, and matching password.
    """
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    hashed_pwd = hash_password(req.password)
    now_iso = datetime.now(timezone.utc).isoformat()

    user_record = {
        "id": user_id,
        "email": req.email.lower().strip(),
        "hashed_password": hashed_pwd,
        "first_name": req.first_name.strip(),
        "last_name": req.last_name.strip(),
        "phone_number": req.phone_number.strip(),
        "role": UserRole.PASSENGER.value, # All public registrations are PASSENGER
        "preferred_language": req.preferred_language,
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    }

    try:
        sb = get_supabase()
        # Check if email is already registered
        existing = sb.table("users").select("id").eq("email", user_record["email"]).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists."
            )
        # Insert user record
        sb.table("users").insert(user_record).execute()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user in Supabase: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register user: {str(e)}"
        )

    # Generate JWT Token
    token_claims = {
        "sub": user_id,
        "email": user_record["email"],
        "first_name": user_record["first_name"],
        "last_name": user_record["last_name"],
        "phone_number": user_record["phone_number"],
        "role": UserRole.PASSENGER.value,
        "preferred_language": req.preferred_language
    }
    access_token = create_access_token(token_claims)

    user_profile = UserProfile(
        user_id=user_id,
        email=user_record["email"],
        first_name=user_record["first_name"],
        last_name=user_record["last_name"],
        phone_number=user_record["phone_number"],
        role=UserRole.PASSENGER,
        preferred_language=req.preferred_language,
        created_at=now_iso
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_profile
    )

@router.post("/login", response_model=TokenResponse)
async def login_user(req: UserLoginRequest):
    """
    Authenticates user (PASSENGER or ADMIN) with email and password.
    Returns JWT access token with user profile and role.
    """
    clean_email = req.email.lower().strip()
    try:
        sb = get_supabase()
        res = sb.table("users").select("*").eq("email", clean_email).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password."
            )
        user_data = res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying user from Supabase during login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during login: {str(e)}"
        )

    # Verify password
    if not verify_password(req.password, user_data.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user_data.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Please contact support."
        )

    user_role = UserRole(user_data.get("role", "PASSENGER"))

    # Generate JWT Token
    token_claims = {
        "sub": user_data["id"],
        "email": user_data["email"],
        "first_name": user_data.get("first_name", ""),
        "last_name": user_data.get("last_name", ""),
        "phone_number": user_data.get("phone_number"),
        "role": user_role.value,
        "preferred_language": user_data.get("preferred_language", "en")
    }
    access_token = create_access_token(token_claims)

    user_profile = UserProfile(
        user_id=user_data["id"],
        email=user_data["email"],
        first_name=user_data.get("first_name", ""),
        last_name=user_data.get("last_name", ""),
        phone_number=user_data.get("phone_number"),
        role=user_role,
        preferred_language=user_data.get("preferred_language", "en"),
        created_at=user_data.get("created_at")
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_profile
    )

@router.get("/me", response_model=UserProfile)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns the currently authenticated user profile and role from the JWT token.
    """
    return UserProfile(
        user_id=current_user["user_id"],
        email=current_user["email"],
        first_name=current_user.get("first_name", ""),
        last_name=current_user.get("last_name", ""),
        phone_number=current_user.get("phone_number"),
        role=UserRole(current_user["role"]),
        preferred_language=current_user.get("preferred_language", "en"),
        created_at=current_user.get("created_at")
    )

@router.put("/me", response_model=UserProfile)
async def update_me(
    payload: UpdateProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Updates the current user's profile details and returns the updated profile.
    """
    user_id = current_user["user_id"]
    update_data: Dict[str, Any] = {}
    if payload.first_name is not None:
        update_data["first_name"] = payload.first_name.strip()
    if payload.last_name is not None:
        update_data["last_name"] = payload.last_name.strip()
    if payload.phone_number is not None:
        update_data["phone_number"] = payload.phone_number.strip()
    if payload.preferred_language is not None:
        update_data["preferred_language"] = payload.preferred_language.strip()

    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        try:
            sb = get_supabase()
            sb.table("users").update(update_data).eq("id", user_id).execute()
        except Exception as e:
            logger.warning(f"Could not update user in Supabase ({e}). Updating locally.")

    return UserProfile(
        user_id=user_id,
        email=current_user["email"],
        first_name=update_data.get("first_name", current_user.get("first_name", "")),
        last_name=update_data.get("last_name", current_user.get("last_name", "")),
        phone_number=update_data.get("phone_number", current_user.get("phone_number")),
        role=UserRole(current_user["role"]),
        preferred_language=update_data.get("preferred_language", current_user.get("preferred_language", "en")),
        created_at=current_user.get("created_at")
    )

