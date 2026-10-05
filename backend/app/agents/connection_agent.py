from app.agents.base import BaseAgent
from app.orchestrator.state import JourneyState
from app.schemas.journey import AgentResultSchema
from app.schemas.connection import ConnectionResult
from app.schemas.flight import parse_flight_time
from datetime import timedelta
from typing import Dict, Any, Optional

DEFAULT_MCT_MINUTES = 60
HIGH_RISK_MARGIN_MINUTES = 20      # buffer below this over MCT -> HIGH_RISK
MODERATE_RISK_MARGIN_MINUTES = 45  # buffer below this over MCT -> MODERATE_RISK


def _expected_time(flight: Dict[str, Any], kind: str) -> tuple[Optional[str], bool]:
    """
    Most reliable time for a flight's arrival or departure: actual > estimated > scheduled.
    When only the scheduled time is known, a reported delay is added to it.
    Returns (iso_time, estimated_from_delay).
    """
    for field in (f"actual_{kind}", f"estimated_{kind}"):
        if flight.get(field):
            return flight[field], False
    scheduled = flight.get(f"scheduled_{kind}")
    delay = flight.get("delay_minutes") or 0
    if scheduled and delay > 0:
        try:
            shifted = parse_flight_time(scheduled) + timedelta(minutes=delay)
        except ValueError:
            return scheduled, False
        return shifted.strftime("%Y-%m-%dT%H:%M:%SZ"), True
    return scheduled, False


def classify_connection(available_minutes: int, mct_minutes: int) -> tuple[str, str]:
    """Map an available connection window to a status and its reason code."""
    if available_minutes < 0:
        return "MISSED", "NEGATIVE_CONNECTION_WINDOW"
    if available_minutes < mct_minutes:
        return "LIKELY_MISSED", "BELOW_MINIMUM_CONNECTION_TIME"
    if available_minutes < mct_minutes + HIGH_RISK_MARGIN_MINUTES:
        return "HIGH_RISK", "TIGHT_TRANSFER_BUFFER"
    if available_minutes < mct_minutes + MODERATE_RISK_MARGIN_MINUTES:
        return "MODERATE_RISK", "MODERATE_BUFFER"
    return "SAFE", "SUFFICIENT_TRANSFER_TIME"


def evaluate_connection(inbound: Dict[str, Any], outbound: Dict[str, Any], mct_minutes: int, index: int = 0) -> ConnectionResult:
    """
    Deterministic connection feasibility for one transfer:
    available_connection_time = next_flight_departure - previous_flight_expected_arrival
    Uses the most reliable time available: actual > estimated > scheduled.
    """
    airport = inbound.get("destination") or outbound.get("origin")
    arrival, arrival_from_delay = _expected_time(inbound, "arrival")
    departure, departure_from_delay = _expected_time(outbound, "departure")

    def result(status: str, reasons: list, available: int = 0, buffer: int = 0) -> ConnectionResult:
        return ConnectionResult(
            connection_index=index,
            airport=airport,
            inbound_flight=inbound.get("flight_number"),
            outbound_flight=outbound.get("flight_number"),
            expected_arrival=arrival,
            next_departure=departure,
            available_connection_minutes=available,
            minimum_required_minutes=mct_minutes,
            buffer_minutes=buffer,
            status=status,
            reason_codes=reasons,
        )

    if inbound.get("status") == "CANCELLED":
        return result("MISSED", ["INBOUND_FLIGHT_CANCELLED"])
    if outbound.get("status") == "CANCELLED":
        return result("MISSED", ["OUTBOUND_FLIGHT_CANCELLED"])
    if inbound.get("status") == "DIVERTED":
        return result("LIKELY_MISSED", ["INBOUND_FLIGHT_DIVERTED"])

    if inbound.get("destination") and outbound.get("origin") and inbound["destination"] != outbound["origin"]:
        airport = f"{inbound['destination']}/{outbound['origin']}"
        return result("UNKNOWN", ["AIRPORT_MISMATCH"])

    if not arrival or not departure:
        return result("UNKNOWN", ["MISSING_TIMING_DATA"])

    try:
        arr_dt, dep_dt = parse_flight_time(arrival), parse_flight_time(departure)
    except ValueError:
        return result("UNKNOWN", ["INVALID_TIME_FORMAT"])

    available = int((dep_dt - arr_dt).total_seconds() // 60)
    status, reason = classify_connection(available, mct_minutes)

    reasons = []
    if inbound.get("delay_minutes", 0) > 0:
        reasons.append("INBOUND_FLIGHT_DELAYED")
    if outbound.get("delay_minutes", 0) > 0:
        reasons.append("OUTBOUND_FLIGHT_DELAYED")
    if arrival_from_delay:
        reasons.append("ARRIVAL_ESTIMATED_FROM_DELAY")
    if departure_from_delay:
        reasons.append("DEPARTURE_ESTIMATED_FROM_DELAY")
    reasons.append(reason)

    return result(status, reasons, available, available - mct_minutes)


class ConnectionAgent(BaseAgent):
    """
    Connection Feasibility Agent.
    Evaluates every transfer between consecutive legs using deterministic arithmetic (no LLM):
    available_connection_time = next_flight_departure - previous_flight_expected_arrival
    """
    def __init__(self, default_mct_minutes: int = DEFAULT_MCT_MINUTES, mct_by_airport: Optional[Dict[str, int]] = None):
        super().__init__(name="connection_agent")
        self.default_mct_minutes = default_mct_minutes
        self.mct_by_airport = mct_by_airport or {}

    async def execute(self, state: JourneyState) -> AgentResultSchema:
        flights = state.flight_results
        if len(flights) < 2:
            # Single-leg journey, no connection calculation needed
            state.connection_results = []
            return self.create_result(
                status="success",
                data={"connection_results": [], "note": "Direct flight, no transfer connections required."},
                trace_id=state.trace_id,
                confidence="high"
            )

        connection_results = []
        warnings = []
        for i in range(len(flights) - 1):
            inbound, outbound = flights[i], flights[i + 1]
            mct = self.mct_by_airport.get(inbound.get("destination"), self.default_mct_minutes)
            conn = evaluate_connection(inbound, outbound, mct, index=i)
            connection_results.append(conn.model_dump())

            if conn.status == "UNKNOWN":
                warnings.append(
                    f"Connection {inbound.get('flight_number')} → {outbound.get('flight_number')} "
                    f"could not be assessed ({', '.join(conn.reason_codes)})."
                )

        state.connection_results = connection_results
        state.warnings.extend(warnings)

        unknown = sum(1 for c in connection_results if c["status"] == "UNKNOWN")
        if unknown == 0:
            status, confidence = "success", "high"
        elif unknown < len(connection_results):
            status, confidence = "partial", "medium"
        else:
            status, confidence = "partial", "low"

        return self.create_result(
            status=status,
            data={"connection_results": connection_results},
            trace_id=state.trace_id,
            confidence=confidence,
            warnings=warnings
        )
