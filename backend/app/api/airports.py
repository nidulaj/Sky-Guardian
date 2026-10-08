from fastapi import APIRouter, HTTPException, Query
from app.providers.airports import get_airport, search_airports
from app.schemas.airport import Airport
from typing import List

router = APIRouter(prefix="/api/airports", tags=["Airports"])


@router.get("/search", response_model=List[Airport])
async def search(q: str = Query(..., min_length=2, max_length=64, description="City, airport name or IATA code"),
                 limit: int = Query(8, ge=1, le=20)):
    """Airport suggestions for autocomplete, e.g. q=colombo -> CMB first."""
    return search_airports(q, limit)


@router.get("/{code}", response_model=Airport)
async def get(code: str):
    airport = get_airport(code) if len(code) == 3 and code.isalpha() else None
    if airport is None:
        raise HTTPException(status_code=404, detail="Unknown airport code")
    return airport
