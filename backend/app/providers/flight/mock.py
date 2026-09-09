from app.providers.flight.base import FlightDataProvider
from typing import Dict, Any
from datetime import datetime, timedelta

class MockFlightProvider(FlightDataProvider):
    """
    Mock flight provider containing deterministic demo data.
    Primary demo scenario:
    - UL001 (CMB -> KUL): Delayed by 90 minutes.
    - XX123 (KUL -> NRT): On time. Scheduled departure 50 mins after UL001 original arrival.
    """
    async def get_flight_status(self, flight_number: str, travel_date: str, origin: str, destination: str) -> Dict[str, Any]:
        flight_upper = flight_number.upper().strip()
        
        if flight_upper == "UL001" or (origin.upper() == "CMB" and destination.upper() == "KUL"):
            sched_dep = f"{travel_date}T10:00:00Z"
            est_dep = f"{travel_date}T11:30:00Z" # 90 min delay
            sched_arr = f"{travel_date}T15:30:00Z"
            est_arr = f"{travel_date}T17:00:00Z" # 90 min delay
            return {
                "flight_number": "UL001",
                "airline": "SriLankan Airlines",
                "origin": "CMB",
                "destination": "KUL",
                "scheduled_departure": sched_dep,
                "estimated_departure": est_dep,
                "actual_departure": None,
                "scheduled_arrival": sched_arr,
                "estimated_arrival": est_arr,
                "actual_arrival": None,
                "status": "DELAYED",
                "delay_minutes": 90,
                "terminal": "T1",
                "gate": "B4",
                "source": "MockFlightProvider (Demo Data)",
                "retrieved_at": datetime.utcnow().isoformat()
            }
        elif flight_upper == "XX123" or (origin.upper() == "KUL" and destination.upper() == "NRT"):
            sched_dep = f"{travel_date}T16:20:00Z"
            sched_arr = f"{travel_date}T23:50:00Z"
            return {
                "flight_number": "XX123",
                "airline": "Malaysia Airlines",
                "origin": "KUL",
                "destination": "NRT",
                "scheduled_departure": sched_dep,
                "estimated_departure": sched_dep,
                "actual_departure": None,
                "scheduled_arrival": sched_arr,
                "estimated_arrival": sched_arr,
                "actual_arrival": None,
                "status": "ON_TIME",
                "delay_minutes": 0,
                "terminal": "KLIA1",
                "gate": "C12",
                "source": "MockFlightProvider (Demo Data)",
                "retrieved_at": datetime.utcnow().isoformat()
            }
        else:
            sched_dep = f"{travel_date}T08:00:00Z"
            sched_arr = f"{travel_date}T12:00:00Z"
            return {
                "flight_number": flight_number,
                "airline": "Generic Airline",
                "origin": origin,
                "destination": destination,
                "scheduled_departure": sched_dep,
                "estimated_departure": sched_dep,
                "actual_departure": None,
                "scheduled_arrival": sched_arr,
                "estimated_arrival": sched_arr,
                "actual_arrival": None,
                "status": "ON_TIME",
                "delay_minutes": 0,
                "terminal": "T1",
                "gate": "A1",
                "source": "MockFlightProvider (Generic)",
                "retrieved_at": datetime.utcnow().isoformat()
            }
