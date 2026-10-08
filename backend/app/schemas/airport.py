from pydantic import BaseModel
from typing import Optional


class Airport(BaseModel):
    """Reference data for one airport (from the airportsdata package, MIT licence)."""
    iata: str
    icao: Optional[str] = None
    name: str
    city: str
    country: str          # ISO 3166-1 alpha-2, e.g. "LK"
    timezone: str         # IANA timezone, e.g. "Asia/Colombo"
    latitude: float
    longitude: float
    major: bool = False   # busy commercial airport, ranked first in search
