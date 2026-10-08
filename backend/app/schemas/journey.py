from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from app.schemas.risk import RiskComponent, RiskFactor

class FlightLegInput(BaseModel):
    flight_number: str = Field(..., example="UL001", description="Airline IATA/ICAO flight code")
    travel_date: str = Field(..., example="2026-09-15", description="YYYY-MM-DD format")
    origin: str = Field(..., example="CMB", description="3-letter IATA airport code")
    destination: str = Field(..., example="KUL", description="3-letter IATA airport code")

class JourneyAnalyzeRequest(BaseModel):
    language: str = Field(default="en", example="en", description="Preferred language code")
    legs: List[FlightLegInput] = Field(..., min_items=1)

class AgentResultSchema(BaseModel):
    agent: str
    status: Literal["success", "partial", "unavailable", "error"]
    data: Dict[str, Any] = {}
    confidence: Literal["high", "medium", "low", "unknown"] = "high"
    evidence: List[Dict[str, Any]] = []
    warnings: List[str] = []
    source_timestamp: Optional[str] = None
    generated_at: str
    trace_id: str

class RiskSummary(BaseModel):
    """
    Risk Agent output (stored in JourneyState.risk_analysis and returned by the API).
    A decision-support score, not a probability. Component scores are None when that
    agent's data is unavailable (see components[...].status / reason), never 0.
    """
    # None with level "UNKNOWN" when no component could be scored.
    score: Optional[int] = Field(None, ge=0, le=100)
    level: Literal["LOW", "MODERATE", "HIGH", "VERY_HIGH", "UNKNOWN"]
    is_probability: Literal[False] = False
    flight_score: Optional[int] = Field(None, ge=0, le=100)
    connection_score: Optional[int] = Field(None, ge=0, le=100)
    weather_score: Optional[int] = Field(None, ge=0, le=100)
    status: Literal["complete", "partial", "insufficient_data"] = "complete"
    confidence: Optional[float] = Field(None, ge=0, le=1)
    confidence_label: Optional[Literal["high", "medium", "low", "unknown"]] = None
    components: Dict[str, RiskComponent] = {}
    weights: Dict[str, float] = {}
    effective_weights: Dict[str, float] = {}
    # Weighted average before any minimum-score override, unrounded.
    weighted_score: Optional[float] = None
    applied_overrides: List[str] = []
    level_thresholds: Dict[str, int] = {}
    missing_data: List[str] = []
    uncertainty: List[str] = []
    top_factors: List[RiskFactor] = []
    explanation: List[str] = []
    warnings: List[str] = []

class ConnectionSummary(BaseModel):
    available_minutes: int
    minimum_required_minutes: int
    buffer_minutes: int
    status: Literal["SAFE", "MODERATE_RISK", "HIGH_RISK", "LIKELY_MISSED", "MISSED", "UNKNOWN"]
    reason_codes: List[str] = []

class JourneyAnalysisResponse(BaseModel):
    journey_id: str
    trace_id: str
    journey_status: str
    risk: RiskSummary
    primary_issue: str
    connection: Optional[ConnectionSummary] = None
    flight_statuses: List[Dict[str, Any]] = []
    weather_conditions: List[Dict[str, Any]] = []
    policy_evidence: List[Dict[str, Any]] = []
    alternatives: List[Dict[str, Any]] = []
    alternative_search: Dict[str, Any] = {}
    recommendation: str
    sources: List[Dict[str, Any]] = []
    warnings: List[str] = []
    is_demo_data: bool = True
    last_updated: str
