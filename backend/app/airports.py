"""
Central airport reference data (IATA code -> name and coordinates).

This is the single place latitude/longitude values live; providers and agents look
airports up here instead of hardcoding coordinates. Coordinates are the airport
reference point, rounded to 4 decimal places.
"""
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class Airport(BaseModel):
    model_config = ConfigDict(frozen=True)

    code: str = Field(..., pattern=r"^[A-Z]{3}$")
    name: str
    city: str
    country: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


_AIRPORT_LIST: List[Airport] = [
    # Demo journey airports (CMB -> KUL -> Tokyo)
    Airport(code="CMB", name="Bandaranaike International Airport", city="Colombo", country="Sri Lanka", latitude=7.1808, longitude=79.8841),
    Airport(code="KUL", name="Kuala Lumpur International Airport", city="Kuala Lumpur", country="Malaysia", latitude=2.7456, longitude=101.7099),
    Airport(code="NRT", name="Narita International Airport", city="Tokyo", country="Japan", latitude=35.7647, longitude=140.3864),
    Airport(code="HND", name="Tokyo Haneda Airport", city="Tokyo", country="Japan", latitude=35.5494, longitude=139.7798),
    # Common connections from Colombo
    Airport(code="MLE", name="Velana International Airport", city="Malé", country="Maldives", latitude=4.1918, longitude=73.5291),
    Airport(code="MAA", name="Chennai International Airport", city="Chennai", country="India", latitude=12.9941, longitude=80.1709),
    Airport(code="BOM", name="Chhatrapati Shivaji Maharaj International Airport", city="Mumbai", country="India", latitude=19.0896, longitude=72.8656),
    Airport(code="DEL", name="Indira Gandhi International Airport", city="Delhi", country="India", latitude=28.5562, longitude=77.1000),
    Airport(code="SIN", name="Singapore Changi Airport", city="Singapore", country="Singapore", latitude=1.3644, longitude=103.9915),
    Airport(code="BKK", name="Suvarnabhumi Airport", city="Bangkok", country="Thailand", latitude=13.6900, longitude=100.7501),
    Airport(code="HKG", name="Hong Kong International Airport", city="Hong Kong", country="China", latitude=22.3080, longitude=113.9185),
    Airport(code="DXB", name="Dubai International Airport", city="Dubai", country="United Arab Emirates", latitude=25.2532, longitude=55.3657),
    Airport(code="DOH", name="Hamad International Airport", city="Doha", country="Qatar", latitude=25.2731, longitude=51.6081),
    Airport(code="LHR", name="London Heathrow Airport", city="London", country="United Kingdom", latitude=51.4700, longitude=-0.4543),
    Airport(code="SYD", name="Sydney Kingsford Smith Airport", city="Sydney", country="Australia", latitude=-33.9399, longitude=151.1753),
]

AIRPORTS: Dict[str, Airport] = {a.code: a for a in _AIRPORT_LIST}


def normalize_airport_code(code: Optional[str]) -> str:
    return (code or "").strip().upper()


def get_airport(code: Optional[str]) -> Optional[Airport]:
    """Returns the airport for an IATA code (case-insensitive), or None if unknown."""
    return AIRPORTS.get(normalize_airport_code(code))


def list_airports() -> List[Airport]:
    return list(_AIRPORT_LIST)
