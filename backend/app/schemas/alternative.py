from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.flight import FlightResult


class AlternativeSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    origin: str = Field(pattern=r"^[A-Z]{3}$")
    destination: str = Field(pattern=r"^[A-Z]{3}$")
    earliest_departure: datetime
    latest_departure: datetime

    @field_validator("earliest_departure", "latest_departure")
    @classmethod
    def aware_time(cls, value):
        if value.utcoffset() is None:
            raise ValueError("search timestamps must include a timezone")
        return value

    @model_validator(mode="after")
    def valid_window(self):
        if self.origin == self.destination or not 0 < (self.latest_departure - self.earliest_departure).total_seconds() <= 48 * 3600:
            raise ValueError("search requires distinct airports and a window of at most 48 hours")
        return self


class AlternativeCandidate(BaseModel):
    legs: list[FlightResult] = Field(min_length=1, max_length=2)


class AlternativeSearchResult(BaseModel):
    candidates: list[AlternativeCandidate] = []
    warnings: list[str] = []
    complete: bool = True
    available: bool = True


class AlternativeOption(BaseModel):
    rank: int = 0
    option_id: str
    route_summary: str
    legs: list[FlightResult]
    departure: str
    arrival: str
    duration_minutes: int
    connections: int
    connection_safety: list[dict] = []
    risk_score: int | None = None
    risk_level: str = "UNKNOWN"
    risk_confidence: str = "unknown"
    risk_missing_data: list[str] = []
    price: Literal["UNKNOWN"] = "UNKNOWN"
    availability_status: Literal["UNKNOWN"] = "UNKNOWN"
    policy_eligibility: Literal["UNKNOWN"] = "UNKNOWN"
    ranking_score: float = 0
    ranking_factors: dict[str, float] = {}
    ranking_weights: dict[str, float] = {}
    ranking_config_version: str
    ranking_reasons: list[str] = []
    warnings: list[str] = []
    sources: list[dict] = []
    data_mode: Literal["live", "timetable", "demo"]
    retrieved_at: str
