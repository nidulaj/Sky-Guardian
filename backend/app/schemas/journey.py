from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime

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
    score: int
    level: Literal["LOW", "MODERATE", "HIGH", "VERY_HIGH"]
    is_probability: bool = False
    flight_score: float
    connection_score: float
    weather_score: float

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
    recommendation: str
    sources: List[Dict[str, Any]] = []
    warnings: List[str] = []
    is_demo_data: bool = True
    last_updated: str
