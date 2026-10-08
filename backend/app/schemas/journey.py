from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, date
import re
from app.schemas.risk import RiskComponent, RiskFactor
from app.schemas.recovery import RecommendationMode, RecoveryPlan

# Same rules as frontend/src/components/journey/validation.ts: IATA (2 chars, at least one
# letter) or ICAO (3 letters) airline code, 1-4 digits, optional suffix letter.
FLIGHT_NUMBER = re.compile(r"^(?:[A-Z]{2}|[A-Z][0-9]|[0-9][A-Z]|[A-Z]{3})[0-9]{1,4}[A-Z]?$")
AIRPORT = re.compile(r"^[A-Z]{3}$")

class FlightLegInput(BaseModel):
    flight_number: str = Field(..., example="UL001", description="Airline IATA/ICAO flight code")
    travel_date: str = Field(..., example="2026-09-15", description="YYYY-MM-DD format")
    origin: str = Field(..., example="CMB", description="3-letter IATA airport code")
    destination: str = Field(..., example="KUL", description="3-letter IATA airport code")

    @field_validator("flight_number", mode="before")
    @classmethod
    def _normalise_flight_number(cls, value):
        value = re.sub(r"\s+", "", value).upper() if isinstance(value, str) else value
        if not isinstance(value, str) or not FLIGHT_NUMBER.match(value):
            raise ValueError("Flight number must look like UL001 or SQ638.")
        return value

    @field_validator("origin", "destination", mode="before")
    @classmethod
    def _normalise_airport(cls, value):
        value = value.strip().upper() if isinstance(value, str) else value
        if not isinstance(value, str) or not AIRPORT.match(value):
            raise ValueError("Airport must be a 3-letter IATA code, for example CMB.")
        return value

    @field_validator("travel_date", mode="before")
    @classmethod
    def _valid_date(cls, value):
        value = value.strip() if isinstance(value, str) else value
        try:
            # fromisoformat also accepts "20260915", so require the dashed form explicitly.
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError
            date.fromisoformat(value)
        except (TypeError, ValueError):
            raise ValueError("Travel date must be a valid YYYY-MM-DD date.")
        return value

    @model_validator(mode="after")
    def _different_airports(self):
        if self.origin == self.destination:
            raise ValueError("Origin and destination must be different airports.")
        return self

class JourneyAnalyzeRequest(BaseModel):
    language: str = Field(default="en", example="en", description="Preferred language code", max_length=10)
    legs: List[FlightLegInput] = Field(..., min_length=1, max_length=4)
    # Passenger explicitly asked for alternatives (a recovery trigger, blueprint 5.1).
    request_alternatives: bool = False

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

class AgentRun(BaseModel):
    """Public trace entry for one agent step: status and timing only, never internal reasoning."""
    agent: str
    status: Literal["success", "partial", "unavailable", "error", "skipped"]
    confidence: Optional[str] = None
    warnings: List[str] = []
    started_at: Optional[str] = None
    duration_ms: Optional[int] = None
    # Short passenger-safe message; no stack traces, provider errors or keys.
    error: Optional[str] = None

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
    # Structured plan behind `recommendation`; mode says whether it is a validated LLM answer.
    recovery_plan: Optional[RecoveryPlan] = None
    recommendation_mode: RecommendationMode = "template"
    sources: List[Dict[str, Any]] = []
    warnings: List[str] = []
    is_demo_data: bool = True
    last_updated: str
    # Public workflow trace: each agent's status, timing and warnings (no model reasoning).
    workflow_status: str = "COMPLETED"
    workflow_trace: List[AgentRun] = []
    recovery_triggered: bool = False
    recovery_reasons: List[str] = []
