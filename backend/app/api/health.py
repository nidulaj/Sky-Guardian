from fastapi import APIRouter
from datetime import datetime, timezone
from app.config import settings

router = APIRouter(prefix="/api/health", tags=["Health"])

@router.get("")
async def get_health():
    return {
        "status": "ok",
        "app_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
