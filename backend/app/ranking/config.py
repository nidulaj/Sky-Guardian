import math
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.config import settings


class RankingConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    version: str = "1.0"
    weights: dict[str, float] = {"disruption_risk": 0.40, "arrival_quality": 0.20, "travel_duration": 0.20, "stops": 0.10, "connection_safety": 0.10}
    max_stops: int = Field(1, ge=0, le=1)
    minimum_connection_minutes: int = Field(60, ge=1, le=360)
    minimum_connection_margin_minutes: int = Field(20, ge=0, le=180)
    boarding_buffer_minutes: int = Field(60, ge=1, le=360)
    target_connection_buffer_minutes: int = Field(120, ge=1)
    max_duration_minutes: int = Field(2160, ge=60, le=4320)
    search_window_hours: int = Field(48, ge=1, le=48)
    max_snapshot_age_seconds: int = Field(900, ge=60)
    max_results: int = Field(3, ge=1, le=10)
    max_candidates: int = Field(200, ge=1, le=500)
    max_provider_requests: int = Field(8, ge=1, le=12)
    timeout_seconds: float = Field(20, gt=0, le=60)
    transfer_airports: list[str] = ["SIN", "KUL"]

    @model_validator(mode="after")
    def validate_settings(self):
        factors = {"disruption_risk", "arrival_quality", "travel_duration", "stops", "connection_safety"}
        if set(self.weights) != factors or any(not math.isfinite(v) or not 0 <= v <= 1 for v in self.weights.values()):
            raise ValueError("ranking weights must contain the five supported factors with values in [0, 1]")
        if not math.isclose(sum(self.weights.values()), 1, abs_tol=1e-6):
            raise ValueError("ranking weights must sum to 1")
        if len(self.transfer_airports) > 2 or any(len(a) != 3 or not a.isascii() or not a.isupper() or not a.isalpha() for a in self.transfer_airports):
            raise ValueError("configure at most two three-letter IATA transfer airports")
        return self


def get_ranking_config() -> RankingConfig:
    path = Path(settings.RANKING_CONFIG_PATH) if settings.RANKING_CONFIG_PATH else Path(__file__).resolve().parents[3] / "config/ranking.yaml"
    if not path.exists() and not settings.RANKING_CONFIG_PATH:
        return RankingConfig()
    with path.open(encoding="utf-8") as stream:
        return RankingConfig.model_validate(yaml.safe_load(stream))
