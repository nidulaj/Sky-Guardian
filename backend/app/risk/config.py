"""
Configuration for the deterministic risk engine (Weather Agent + Risk Agent).

Values are read from config/risk.yaml. The defaults below mirror that file so the
backend still starts when the file is not mounted (e.g. the backend-only Docker
image). An invalid file fails fast instead of silently scoring with bad weights.
"""
from __future__ import annotations

import logging
import math
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Literal, Optional

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

logger = logging.getLogger(__name__)

RiskLevel = Literal["LOW", "MODERATE", "HIGH", "VERY_HIGH"]

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[3] / "config" / "risk.yaml"


class _ConfigModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


Score = Field(ge=0, le=100)


class RiskWeights(_ConfigModel):
    flight: float = Field(0.35, ge=0, le=1)
    connection: float = Field(0.40, ge=0, le=1)
    weather: float = Field(0.25, ge=0, le=1)

    @model_validator(mode="after")
    def _weights_sum_to_one(self) -> "RiskWeights":
        total = self.flight + self.connection + self.weather
        if not math.isclose(total, 1.0, abs_tol=1e-6):
            raise ValueError(f"risk weights must sum to 1.0, got {total:.4f}")
        return self

    def as_dict(self) -> Dict[str, float]:
        return {"flight": self.flight, "connection": self.connection, "weather": self.weather}


class LevelThresholds(_ConfigModel):
    """Inclusive upper bounds of each level; anything above high_max is VERY_HIGH."""
    low_max: int = 29
    moderate_max: int = 59
    high_max: int = 79

    @model_validator(mode="after")
    def _ordered(self) -> "LevelThresholds":
        if not (0 <= self.low_max < self.moderate_max < self.high_max < 100):
            raise ValueError("level thresholds must satisfy 0 <= low_max < moderate_max < high_max < 100")
        return self

    def level_for(self, score: int) -> RiskLevel:
        if score <= self.low_max:
            return "LOW"
        if score <= self.moderate_max:
            return "MODERATE"
        if score <= self.high_max:
            return "HIGH"
        return "VERY_HIGH"


class DelayBand(_ConfigModel):
    max_minutes: int = Field(ge=0)
    score: int = Score


class FlightScoringConfig(_ConfigModel):
    delay_bands: List[DelayBand] = [
        DelayBand(max_minutes=0, score=0),
        DelayBand(max_minutes=15, score=10),
        DelayBand(max_minutes=30, score=25),
        DelayBand(max_minutes=60, score=45),
        DelayBand(max_minutes=90, score=65),
        DelayBand(max_minutes=120, score=80),
    ]
    above_max_band_score: int = Field(95, ge=0, le=100)
    cancelled_score: int = Field(100, ge=0, le=100)
    diverted_score: int = Field(90, ge=0, le=100)
    max_plausible_delay_minutes: int = Field(4320, gt=0)

    @model_validator(mode="after")
    def _bands_ascending(self) -> "FlightScoringConfig":
        if not self.delay_bands:
            raise ValueError("flight.delay_bands must not be empty")
        bounds = [b.max_minutes for b in self.delay_bands]
        scores = [b.score for b in self.delay_bands] + [self.above_max_band_score]
        if bounds != sorted(set(bounds)):
            raise ValueError("flight.delay_bands max_minutes must be strictly ascending")
        if scores != sorted(scores):
            raise ValueError("flight.delay_bands scores must not decrease as delay grows")
        return self


class ConnectionScoringConfig(_ConfigModel):
    default_mct_minutes: int = Field(60, ge=0, le=1440)
    # Margins are measured above the minimum connection time (MCT).
    tight_margin_minutes: int = Field(20, ge=0)
    moderate_margin_minutes: int = Field(45, ge=0)
    impossible_score: int = Field(100, ge=0, le=100)
    below_mct_score: int = Field(90, ge=0, le=100)
    tight_score: int = Field(70, ge=0, le=100)
    moderate_score: int = Field(40, ge=0, le=100)
    comfortable_score: int = Field(10, ge=0, le=100)

    @model_validator(mode="after")
    def _ordered(self) -> "ConnectionScoringConfig":
        if self.tight_margin_minutes >= self.moderate_margin_minutes:
            raise ValueError("connection.tight_margin_minutes must be below moderate_margin_minutes")
        return self


class PrecipitationConfig(_ConfigModel):
    # Standard meteorological rain-rate categories (mm/h).
    light_max_mm_per_hr: float = 2.5
    moderate_max_mm_per_hr: float = 7.6
    light_score: int = Field(5, ge=0, le=100)
    moderate_score: int = Field(18, ge=0, le=100)
    heavy_score: int = Field(35, ge=0, le=100)


class WindConfig(_ConfigModel):
    strong_sustained_kt: float = 20
    strong_gust_kt: float = 30
    severe_sustained_kt: float = 34
    severe_gust_kt: float = 45
    strong_score: int = Field(15, ge=0, le=100)
    severe_score: int = Field(28, ge=0, le=100)


class VisibilityConfig(_ConfigModel):
    reduced_below_km: float = 5.0
    very_low_below_km: float = 1.5
    reduced_score: int = Field(15, ge=0, le=100)
    very_low_score: int = Field(28, ge=0, le=100)


class ThunderstormConfig(_ConfigModel):
    possible_score: int = Field(15, ge=0, le=100)
    active_score: int = Field(30, ge=0, le=100)


class SnowIceConfig(_ConfigModel):
    light_score: int = Field(15, ge=0, le=100)
    heavy_score: int = Field(30, ge=0, le=100)
    freezing_score: int = Field(30, ge=0, le=100)


class AlertConfig(_ConfigModel):
    advisory_score: int = Field(10, ge=0, le=100)
    warning_score: int = Field(25, ge=0, le=100)
    severe_score: int = Field(30, ge=0, le=100)


class LeadTimeFactor(_ConfigModel):
    beyond_hours: float = Field(ge=0)
    factor: float = Field(gt=0, le=1)


class WeatherScoringConfig(_ConfigModel):
    precipitation: PrecipitationConfig = PrecipitationConfig()
    wind: WindConfig = WindConfig()
    visibility: VisibilityConfig = VisibilityConfig()
    thunderstorm: ThunderstormConfig = ThunderstormConfig()
    snow_ice: SnowIceConfig = SnowIceConfig()
    alerts: AlertConfig = AlertConfig()
    # Rain, snow/ice and thunderstorms are strongly correlated: the strongest of the
    # group counts fully, the others are multiplied by this factor (avoids double-counting).
    precipitation_group_correlation_factor: float = Field(0.5, ge=0, le=1)
    base_confidence: float = Field(0.9, gt=0, le=1)
    missing_field_confidence_penalty: float = Field(0.15, ge=0, le=1)
    lead_time_factors: List[LeadTimeFactor] = [
        LeadTimeFactor(beyond_hours=24, factor=0.9),
        LeadTimeFactor(beyond_hours=72, factor=0.75),
    ]


class OverrideConfig(_ConfigModel):
    """Minimum journey score when an event makes disruption near-certain."""
    cancelled_flight_min_score: int = Field(90, ge=0, le=100)
    impossible_connection_min_score: int = Field(80, ge=0, le=100)


class TriggerConfig(_ConfigModel):
    recovery_trigger_threshold: int = Field(60, ge=0, le=100)


class ConfidenceConfig(_ConfigModel):
    mock_data_factor: float = Field(0.8, gt=0, le=1)
    estimated_times_factor: float = Field(0.9, gt=0, le=1)
    default_mct_factor: float = Field(0.9, gt=0, le=1)


class RiskConfig(_ConfigModel):
    weights: RiskWeights = RiskWeights()
    levels: LevelThresholds = LevelThresholds()
    flight: FlightScoringConfig = FlightScoringConfig()
    connection: ConnectionScoringConfig = ConnectionScoringConfig()
    weather: WeatherScoringConfig = WeatherScoringConfig()
    overrides: OverrideConfig = OverrideConfig()
    triggers: TriggerConfig = TriggerConfig()
    confidence: ConfidenceConfig = ConfidenceConfig()


def load_risk_config(path: Optional[str | Path] = None) -> RiskConfig:
    """Load and validate risk configuration. Raises on an invalid file."""
    config_path = Path(path) if path else DEFAULT_CONFIG_PATH
    if not config_path.is_file():
        if path:
            raise FileNotFoundError(f"Risk config file not found: {config_path}")
        logger.info("Risk config %s not found; using built-in defaults.", config_path)
        return RiskConfig()

    with config_path.open("r", encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"Risk config {config_path} must contain a mapping at the top level")
    return RiskConfig.model_validate(raw)


@lru_cache(maxsize=1)
def get_risk_config() -> RiskConfig:
    from app.config import settings
    return load_risk_config(settings.RISK_CONFIG_PATH)


def round_half_up(value: float) -> int:
    """Deterministic rounding (Python's round() uses banker's rounding)."""
    return int(math.floor(value + 0.5))


def confidence_label(confidence: float) -> Literal["high", "medium", "low", "unknown"]:
    """Maps a 0-1 confidence onto the AgentResultSchema label."""
    if confidence >= 0.8:
        return "high"
    if confidence >= 0.5:
        return "medium"
    if confidence > 0:
        return "low"
    return "unknown"
