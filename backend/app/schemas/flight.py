from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone

# Operational status of a single flight leg as reported by a FlightDataProvider.
FlightStatus = Literal[
    "SCHEDULED",
    "ON_TIME",
    "DELAYED",
    "DEPARTED",
    "LANDED",
    "CANCELLED",
    "DIVERTED",
    "UNKNOWN",
]

# Where a flight result came from: live status, published timetable, demo data or nothing.
DataMode = Literal["live", "timetable", "demo", "none"]

# Flight designator: airline code + 1-4 digit number + optional suffix.
# Airline code is IATA (2 characters, at least one letter: UL, 6E, U2) or ICAO (3 letters: SLK).
FLIGHT_NUMBER_PATTERN = r"^(?:[A-Z]{2}|[A-Z][0-9]|[0-9][A-Z]|[A-Z]{3})[0-9]{1,4}[A-Z]?$"
TRAVEL_DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
AIRPORT_CODE_PATTERN = r"^[A-Z]{3}$"


def parse_flight_time(value: Optional[str]) -> Optional[datetime]:
    """Parse an ISO 8601 flight timestamp. Naive values are treated as UTC. Raises ValueError if unreadable."""
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


class FlightResult(BaseModel):
    """
    Structured flight result produced by the Flight Agent for one journey leg.
    All timestamps are ISO 8601 strings in UTC (e.g. 2026-09-15T15:30:00Z); None when not known.
    """
    flight_number: str
    airline: Optional[str] = None
    origin: str
    destination: str
    scheduled_departure: Optional[str] = None
    estimated_departure: Optional[str] = None
    actual_departure: Optional[str] = None
    scheduled_arrival: Optional[str] = None
    estimated_arrival: Optional[str] = None
    actual_arrival: Optional[str] = None
    status: FlightStatus = "UNKNOWN"
    delay_minutes: int = Field(default=0, ge=0)
    terminal: Optional[str] = None          # departure terminal
    gate: Optional[str] = None              # departure gate
    arrival_terminal: Optional[str] = None
    source: str
    retrieved_at: str
    reason_codes: list[str] = []
    data_mode: DataMode = "none"
    # Airport reference data for display (names, cities, IANA timezones for local times)
    origin_name: Optional[str] = None
    origin_city: Optional[str] = None
    origin_timezone: Optional[str] = None
    destination_name: Optional[str] = None
    destination_city: Optional[str] = None
    destination_timezone: Optional[str] = None
