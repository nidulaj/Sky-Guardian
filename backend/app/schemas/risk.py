from pydantic import BaseModel, Field
from typing import Any, Dict, List, Literal, Optional

RiskLevel = Literal["LOW", "MODERATE", "HIGH", "VERY_HIGH"]
ComponentStatus = Literal["available", "missing", "not_applicable"]
ComponentName = Literal["flight", "connection", "weather"]


class RiskComponent(BaseModel):
    """
    One input to the journey score, built from a single upstream agent's result.

    available      - scored from the agent's output
    missing        - the agent produced no usable result; score stays None (never 0)
    not_applicable - does not apply to this journey (e.g. connection on a direct flight)
    """
    status: ComponentStatus
    score: Optional[int] = Field(None, ge=0, le=100)
    level: Optional[RiskLevel] = None
    confidence: float = Field(..., ge=0, le=1)
    reason: Optional[str] = None
    details: Dict[str, Any] = {}


ConnectionRiskStatus = Literal["SAFE", "MODERATE_RISK", "HIGH_RISK", "LIKELY_MISSED", "MISSED", "UNAVAILABLE"]


class ConnectionRisk(BaseModel):
    """
    Risk view of one transfer, derived from the Connection Agent's ConnectionResult
    (backend/app/risk/connection_risk.py). UNAVAILABLE means the transfer could not be
    assessed: risk_score and the minute fields are None, never 0.
    """
    connection_index: int
    airport: Optional[str] = None
    inbound_flight: Optional[str] = None
    outbound_flight: Optional[str] = None
    status: ConnectionRiskStatus
    risk_score: Optional[int] = Field(None, ge=0, le=100)
    connection_minutes: Optional[int] = None
    required_minutes: Optional[int] = None
    buffer_minutes: Optional[int] = None
    reason: str
    reason_codes: List[str] = []


class RiskFactor(BaseModel):
    """A component's share of the journey score, with a reason taken from the agent's data."""
    factor: str
    component: ComponentName
    impact: int = Field(..., ge=0, le=100, description="Component score (0-100)")
    contribution: float = Field(..., ge=0, le=100, description="Weighted points added to the journey score")
    reason: str
