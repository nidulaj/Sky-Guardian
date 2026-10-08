from app.providers.flight.base import FlightDataProvider, FlightNotFoundError, FlightDataUnavailableError
from app.schemas.flight import FlightResult
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, Optional

# Deterministic demo catalog, keyed by flight number. Times are minutes after 00:00 UTC on the travel date,
# so the same scenario works for any date. Flights not listed here raise FlightNotFoundError.
DEMO_FLIGHTS: Dict[str, Dict[str, Any]] = {
    # Primary demo scenario: UL001 lands 90 min late, leaving 30 min to connect to XX123 at KUL (MCT 60) -> LIKELY_MISSED
    "UL001": {
        "airline": "SriLankan Airlines", "origin": "CMB", "destination": "KUL",
        "dep": 10 * 60, "arr": 15 * 60 + 30, "status": "DELAYED", "delay": 90, "terminal": "T1", "gate": "B4",
    },
    "XX123": {
        "airline": "Malaysia Airlines", "origin": "KUL", "destination": "NRT",
        "dep": 17 * 60 + 30, "arr": 25 * 60, "status": "ON_TIME", "delay": 0, "terminal": "KLIA1", "gate": "C12",
    },
    # Safe connection scenario: UL306 -> SQ638 at SIN with a 120 min transfer window
    "UL306": {
        "airline": "SriLankan Airlines", "origin": "CMB", "destination": "SIN",
        "dep": 6 * 60, "arr": 10 * 60, "status": "ON_TIME", "delay": 0, "terminal": "T1", "gate": "A2",
    },
    "SQ638": {
        "airline": "Singapore Airlines", "origin": "SIN", "destination": "NRT",
        "dep": 12 * 60, "arr": 19 * 60, "status": "ON_TIME", "delay": 0, "terminal": "T3", "gate": "B6",
    },
    # Cancellation scenario
    "UL504": {
        "airline": "SriLankan Airlines", "origin": "CMB", "destination": "LHR",
        "dep": 8 * 60, "arr": 20 * 60, "status": "CANCELLED", "delay": 0, "terminal": "T1", "gate": None,
    },
}

# Flight numbers that simulate the upstream provider being unreachable
SIMULATED_OUTAGE_FLIGHTS = {"XX503"}


def _iso(day: date, minutes: Optional[int]) -> Optional[str]:
    if minutes is None:
        return None
    moment = datetime(day.year, day.month, day.day, tzinfo=timezone.utc) + timedelta(minutes=minutes)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


class MockFlightProvider(FlightDataProvider):
    """
    Mock flight provider containing deterministic demo data (no paid aviation API needed).
    Primary demo scenario:
    - UL001 (CMB -> KUL): Delayed by 90 minutes, expected arrival 17:00 UTC instead of 15:30.
    - XX123 (KUL -> NRT): On time, departs 17:30 UTC -> 30 min connection window at KUL.
    """
    name = "MockFlightProvider"

    async def get_flight_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> FlightResult:
        flight_upper = flight_number.upper().strip()

        if flight_upper in SIMULATED_OUTAGE_FLIGHTS:
            raise FlightDataUnavailableError("Mock provider outage (simulated)")

        flight = DEMO_FLIGHTS.get(flight_upper)
        if flight is None:
            raise FlightNotFoundError(f"No demo data for flight {flight_upper}")

        day = date.fromisoformat(travel_date)
        cancelled = flight["status"] == "CANCELLED"
        delay = flight["delay"]

        return FlightResult(
            flight_number=flight_upper,
            airline=flight["airline"],
            origin=flight["origin"],
            destination=flight["destination"],
            scheduled_departure=_iso(day, flight["dep"]),
            estimated_departure=None if cancelled else _iso(day, flight["dep"] + delay),
            actual_departure=None,
            scheduled_arrival=_iso(day, flight["arr"]),
            estimated_arrival=None if cancelled else _iso(day, flight["arr"] + delay),
            actual_arrival=None,
            status=flight["status"],
            delay_minutes=delay,
            terminal=flight["terminal"],
            gate=flight["gate"],
            source="MockFlightProvider (Demo Data)",
            data_mode="demo",
            retrieved_at=datetime.now(timezone.utc).isoformat(),
        )
