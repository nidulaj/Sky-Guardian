from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictFloat, StrictInt
from typing import Any, Dict, List, Literal, Optional, Union

RiskLevel = Literal["LOW", "MODERATE", "HIGH", "VERY_HIGH"]
ComponentStatus = Literal["available", "missing", "not_applicable"]
ComponentName = Literal["flight", "connection", "weather"]


# ---------------------------------------------------------------------------
# Inputs: what the Risk Agent accepts from upstream agents. Other agents are not
# trusted blindly; anything failing these contracts is treated as missing data.
# ---------------------------------------------------------------------------

class _AgentInput(BaseModel):
    model_config = ConfigDict(extra="ignore")


class FlightRiskInput(_AgentInput):
    flight_number: Optional[str] = Field(None, max_length=10)
    origin: Optional[str] = Field(None, max_length=3)
    destination: Optional[str] = Field(None, max_length=3)
    status: str = Field(..., pattern=r"^[A-Z_]{2,32}$")
    delay_minutes: Optional[StrictInt] = Field(None, ge=-1440, le=10080)
    scheduled_departure: Optional[str] = None
    estimated_departure: Optional[str] = None
    actual_departure: Optional[str] = None
    scheduled_arrival: Optional[str] = None
    estimated_arrival: Optional[str] = None
    actual_arrival: Optional[str] = None
    source: Optional[str] = Field(None, max_length=100)


class ConnectionRiskInput(_AgentInput):
    connection_index: StrictInt = Field(..., ge=0)
    airport: Optional[str] = Field(None, max_length=3)
    available_connection_minutes: Optional[StrictInt] = Field(None, ge=-10080, le=10080)
    minimum_required_minutes: Optional[StrictInt] = Field(None, ge=0, le=1440)
    mct_source: Optional[str] = Field(None, max_length=50)
    inbound_arrival_time: Optional[str] = None
    outbound_departure_time: Optional[str] = None
    status: str = Field(..., pattern=r"^[A-Z_]{2,32}$")
    reason_codes: List[str] = []


class WeatherRiskInput(_AgentInput):
    airport: str = Field(..., pattern=r"^[A-Z]{3}$")
    status: Literal["available", "unavailable"]
    weather_score: Optional[StrictInt] = Field(None, ge=0, le=100)
    weather_risk: Optional[RiskLevel] = None
    conditions: List[str] = []
    forecast_window: Optional[str] = None
    source: str = Field(..., max_length=100)
    is_mock: StrictBool = False
    confidence: Union[StrictFloat, StrictInt] = Field(..., ge=0, le=1)
    missing_data: List[str] = []


# ---------------------------------------------------------------------------
# Output: the standard Risk Agent response, used across the application.
# ---------------------------------------------------------------------------

class RiskComponent(BaseModel):
    status: ComponentStatus
    score: Optional[int] = Field(None, ge=0, le=100)
    level: Optional[RiskLevel] = None
    confidence: float = Field(..., ge=0, le=1)
    reason: Optional[str] = None
    details: Dict[str, Any] = {}


class RiskFactor(BaseModel):
    factor: str
    component: ComponentName
    impact: int = Field(..., ge=0, le=100, description="Component score (0-100)")
    contribution: float = Field(..., ge=0, le=100, description="Weighted points added to the journey score")
    reason: str


class RiskScore(BaseModel):
    score: Optional[int] = Field(None, ge=0, le=100)
    level: Union[RiskLevel, Literal["UNKNOWN"]]
    confidence: float = Field(..., ge=0, le=1)
    is_probability: Literal[False] = False


class RiskCalculation(BaseModel):
    method: Literal["deterministic_weighted_sum"] = "deterministic_weighted_sum"
    weights: Dict[str, float]
    effective_weights: Dict[str, float]
    weighted_score: Optional[float] = None
    applied_overrides: List[str] = []
    level_thresholds: Dict[str, int]


class RiskAssessment(BaseModel):
    journey_id: str
    status: Literal["complete", "partial", "insufficient_data"]
    risk: RiskScore
    components: Dict[ComponentName, RiskComponent]
    top_factors: List[RiskFactor] = []
    uncertainty: List[str] = []
    missing_data: List[str] = []
    data_sources: List[str] = []
    warnings: List[str] = []
    calculation: RiskCalculation
    generated_at: str
