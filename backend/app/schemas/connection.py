from pydantic import BaseModel
from typing import Optional, Literal

ConnectionStatus = Literal["SAFE", "MODERATE_RISK", "HIGH_RISK", "LIKELY_MISSED", "MISSED", "UNKNOWN"]


class ConnectionResult(BaseModel):
    """
    Feasibility of one transfer between consecutive journey legs, produced by the Connection Agent.

    available_connection_minutes = outbound departure - inbound expected arrival
    buffer_minutes = available_connection_minutes - minimum_required_minutes

    Field names match what the Risk Agent, Supervisor and /api/journeys/analyze already consume.
    When status is UNKNOWN the minute fields are 0 and reason_codes explains why.
    """
    connection_index: int
    airport: Optional[str] = None
    inbound_flight: Optional[str] = None
    outbound_flight: Optional[str] = None
    expected_arrival: Optional[str] = None
    next_departure: Optional[str] = None
    available_connection_minutes: int = 0
    minimum_required_minutes: int
    buffer_minutes: int = 0
    status: ConnectionStatus
    reason_codes: list[str] = []
