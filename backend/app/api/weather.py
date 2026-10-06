import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.agents.weather_agent import WeatherAgent
from app.airports import Airport, get_airport, list_airports, normalize_airport_code
from app.schemas.weather import AirportWeatherResult

router = APIRouter(prefix="/api/weather", tags=["Weather"])

weather_agent = WeatherAgent()

UNAVAILABLE_MESSAGE = "Weather data temporarily unavailable."


@router.get("/airports", response_model=List[Airport])
async def get_supported_airports():
    """Airports the Weather Agent has coordinates for."""
    return list_airports()


@router.get("", response_model=AirportWeatherResult)
async def get_airport_weather(
    airport: str = Query(..., description="3-letter IATA airport code, e.g. CMB"),
    at: Optional[datetime] = Query(
        None,
        alias="time",
        description="ISO 8601 target time with timezone offset (default: current hour)",
    ),
):
    code = normalize_airport_code(airport)
    if not re.fullmatch(r"[A-Z]{3}", code):
        raise HTTPException(status_code=422, detail="airport must be a 3-letter IATA code, e.g. CMB.")
    if get_airport(code) is None:
        raise HTTPException(status_code=404, detail=f"Airport {code} is not supported by the Weather Agent.")
    if at is not None and at.tzinfo is None:
        raise HTTPException(status_code=422, detail="time must include a timezone offset, e.g. 2026-10-06T14:00:00+05:30.")

    target_times = [(at, "requested time")] if at is not None else None
    result = await weather_agent.assess_airport(code, target_times=target_times)
    if result.status == "unavailable":
        # Warnings are our own short messages; provider errors and stack traces are never exposed.
        raise HTTPException(status_code=503, detail={"message": UNAVAILABLE_MESSAGE, "reasons": result.warnings})
    return result
