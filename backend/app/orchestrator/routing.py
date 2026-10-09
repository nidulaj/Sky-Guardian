"""Supervisor routing rules: when the Policy and Alternative agents run (blueprint 5.1)."""
from typing import List, Tuple

from app.orchestrator.state import JourneyState

AT_RISK_CONNECTION_STATUSES = {"HIGH_RISK", "LIKELY_MISSED", "MISSED"}


def should_trigger_recovery(state: JourneyState, threshold: int) -> Tuple[bool, List[str]]:
    """
    Return (triggered, reason codes) from every flight leg and connection in state:
    FLIGHT_CANCELLED, CONNECTION_AT_RISK, RISK_ABOVE_THRESHOLD and PASSENGER_REQUESTED.
    An unknown risk score (None) alone never triggers recovery.
    """
    reasons: List[str] = []
    if any(f.get("status") == "CANCELLED" for f in state.flight_results):
        reasons.append("FLIGHT_CANCELLED")
    if any(c.get("status") in AT_RISK_CONNECTION_STATUSES for c in state.connection_results):
        reasons.append("CONNECTION_AT_RISK")
    score = state.risk_analysis.get("score") if state.risk_analysis else None
    if score is not None and score >= threshold:
        reasons.append("RISK_ABOVE_THRESHOLD")
    if state.alternatives_requested:
        reasons.append("PASSENGER_REQUESTED")
    return bool(reasons), reasons
