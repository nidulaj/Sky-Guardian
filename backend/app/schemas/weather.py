from pydantic import BaseModel, ConfigDict, Field
from typing import Dict, List, Literal, Optional
from datetime import datetime

AIRPORT_CODE_PATTERN = r"^[A-Z]{3}$"

ThunderstormState = Literal["NONE", "POSSIBLE", "ACTIVE"]
SnowIceState = Literal["NONE", "LIGHT", "HEAVY", "FREEZING"]
AlertSeverity = Literal["advisory", "warning", "severe"]


class WeatherAlert(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: str = Field(..., min_length=1, max_length=200)
    severity: AlertSeverity
    headline: Optional[str] = Field(None, max_length=500)


class WeatherObservation(BaseModel):
    """
    Provider-neutral weather data for one airport and forecast window.

    Every measurement is optional: None means the provider did not supply it, which
    the scoring treats as missing data (lower confidence), never as "no hazard".
    """
    model_config = ConfigDict(extra="forbid")

    airport: str = Field(..., pattern=AIRPORT_CODE_PATTERN)
    forecast_time: Optional[datetime] = None
    condition_text: Optional[str] = Field(None, max_length=200)
    weather_code: Optional[int] = Field(None, ge=0, le=99, description="WMO weather interpretation code")
    temperature_c: Optional[float] = Field(None, ge=-90, le=60)
    precipitation_mm_per_hr: Optional[float] = Field(None, ge=0, le=500)
    wind_speed_kt: Optional[float] = Field(None, ge=0, le=250)
    wind_gust_kt: Optional[float] = Field(None, ge=0, le=300)
    visibility_km: Optional[float] = Field(None, ge=0, le=100)
    thunderstorm: Optional[ThunderstormState] = None
    snow_ice: Optional[SnowIceState] = None
    # None = alerts unknown; [] = provider confirmed there are no alerts.
    alerts: Optional[List[WeatherAlert]] = None
    source: str = Field(..., min_length=1, max_length=100)
    is_mock: bool
    retrieved_at: datetime


class WeatherFactors(BaseModel):
    rain: bool  # moderate or heavy rain
    strong_wind: bool
    thunderstorm: bool
    low_visibility: bool
    snow_ice: bool
    severe_alert: bool


class WeatherAssessment(BaseModel):
    """Deterministic scoring result for one WeatherObservation."""
    score: Optional[int] = Field(None, ge=0, le=100)
    level: Optional[Literal["LOW", "MODERATE", "HIGH", "VERY_HIGH"]] = None
    conditions: List[str] = []
    factors: WeatherFactors
    component_scores: Dict[str, float] = {}
    missing_data: List[str] = []
    confidence: float = Field(..., ge=0, le=1)
    warnings: List[str] = []


class AirportWeatherResult(BaseModel):
    """Weather Agent output for one airport; this is what the Risk Agent consumes."""
    airport: str = Field(..., pattern=AIRPORT_CODE_PATTERN)
    status: Literal["available", "unavailable"]
    roles: List[str] = []
    weather_risk: Optional[Literal["LOW", "MODERATE", "HIGH", "VERY_HIGH"]] = None
    weather_score: Optional[int] = Field(None, ge=0, le=100)
    conditions: List[str] = []
    factors: Optional[WeatherFactors] = None
    component_scores: Dict[str, float] = {}
    observation: Optional[WeatherObservation] = None
    forecast_window: Optional[str] = None
    source: str
    is_mock: bool = False
    confidence: float = Field(..., ge=0, le=1)
    missing_data: List[str] = []
    warnings: List[str] = []
    retrieved_at: Optional[str] = None
