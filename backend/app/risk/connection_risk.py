"""
Connection risk analysis (supporting component of the Risk Agent).

The Connection Agent (backend/app/agents/connection_agent.py) works out each transfer
window from the Flight Agent's times and classifies it (SAFE ... MISSED, or UNKNOWN).
This module turns one of those ConnectionResult dicts into a ConnectionRisk:
a 0-100 risk_score from config/risk.yaml (connection.status_scores), the measured
minutes and a plain-language reason. It never re-computes times and never invents
values: anything that cannot be assessed is UNAVAILABLE with risk_score None.
"""
from typing import Any, get_args

from app.risk.config import ConnectionScoringConfig
from app.schemas.connection import ConnectionStatus
from app.schemas.risk import ConnectionRisk

_CONNECTION_STATUSES = set(get_args(ConnectionStatus))
# Connection Agent reason codes for which the minute fields are measured, not placeholders.
_TIMED_CODES = {
    "NEGATIVE_CONNECTION_WINDOW", "BELOW_MINIMUM_CONNECTION_TIME", "TIGHT_TRANSFER_BUFFER",
    "MODERATE_BUFFER", "SUFFICIENT_TRANSFER_TIME",
}


def safe_text(value: Any, limit: int = 12) -> str:
    """Identifiers copied from another agent's output, trimmed before they reach user-facing text."""
    if value is None:
        return ""
    return "".join(ch for ch in str(value) if ch.isalnum() or ch in "-/_")[:limit]


def _is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def assess_connection(result: Any, index: int, cfg: ConnectionScoringConfig) -> ConnectionRisk:
    """Risk view of one Connection Agent result. Never raises for bad input."""
    if not isinstance(result, dict):
        return ConnectionRisk(
            connection_index=index, status="UNAVAILABLE", reason="Connection information could not be read.",
        )

    airport = safe_text(result.get("airport")) or None
    inbound = safe_text(result.get("inbound_flight")) or None
    outbound = safe_text(result.get("outbound_flight")) or None
    codes = [safe_text(c, 40) for c in result.get("reason_codes") or [] if isinstance(c, str)]
    common = dict(
        connection_index=index, airport=airport, inbound_flight=inbound, outbound_flight=outbound, reason_codes=codes,
    )

    status = result.get("status")
    if status not in _CONNECTION_STATUSES:
        return ConnectionRisk(**common, status="UNAVAILABLE", reason="unrecognised connection status")
    if status == "UNKNOWN":
        detail = f" ({', '.join(codes)})" if codes else ""
        return ConnectionRisk(**common, status="UNAVAILABLE", reason=f"Required connection information is unavailable{detail}.")

    # Minutes are only reported when the Connection Agent actually measured them.
    minutes, required = result.get("available_connection_minutes"), result.get("minimum_required_minutes")
    timed = bool(set(codes) & _TIMED_CODES) and _is_int(minutes) and _is_int(required)

    return ConnectionRisk(
        **common,
        status=status,
        risk_score=cfg.status_scores[status],
        connection_minutes=minutes if timed else None,
        required_minutes=required if timed else None,
        buffer_minutes=minutes - required if timed else None,
        reason=_reason(airport or "the transfer airport", inbound, outbound, status, set(codes), minutes if timed else None, required if timed else None),
    )


def _reason(airport, inbound, outbound, status, codes, minutes, required) -> str:
    inbound = inbound or "the inbound flight"
    outbound = outbound or "the onward flight"
    status_text = status.replace("_", " ").lower()

    if "INBOUND_FLIGHT_CANCELLED" in codes:
        return f"Connection at {airport} cannot be made: {inbound} is cancelled ({status_text})."
    if "OUTBOUND_FLIGHT_CANCELLED" in codes:
        return f"Connection at {airport} cannot be made: {outbound} is cancelled ({status_text})."
    if "INBOUND_FLIGHT_DIVERTED" in codes:
        return f"Connection at {airport} is at risk: {inbound} has been diverted ({status_text})."
    if minutes is not None:
        if minutes < 0:
            return f"Connection at {airport}: {outbound} is due to leave {-minutes} minutes before {inbound} arrives ({status_text})."
        return (f"Connection at {airport}: {minutes} minutes between {inbound} arriving and {outbound} departing, "
                f"against a {required}-minute minimum ({status_text}).")
    return f"Connection at {airport} is assessed as {status_text}."
