from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import uuid

from app.schemas.journey import AgentRun

class JourneyState(BaseModel):
    journey_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = Field(default="demo-user-123")
    trace_id: str = Field(default_factory=lambda: f"trace-{uuid.uuid4().hex[:12]}")

    preferred_language: str = "en"
    origin: str = ""
    destination: str = ""

    journey_legs: List[Dict[str, Any]] = []
    flight_results: List[Dict[str, Any]] = []
    connection_results: List[Dict[str, Any]] = []
    weather_results: List[Dict[str, Any]] = []
    risk_analysis: Optional[Dict[str, Any]] = None
    policy_evidence: List[Dict[str, Any]] = []
    alternative_options: List[Dict[str, Any]] = []
    alternative_search: Dict[str, Any] = {"status": "not_needed"}
    recommended_option: Optional[Dict[str, Any]] = None
    recommendation_text: str = ""
    recovery_plan: Optional[Dict[str, Any]] = None

    # Supervisor routing and public workflow trace
    alternatives_requested: bool = False
    recovery_triggered: bool = False
    recovery_reasons: List[str] = []
    agent_runs: List[AgentRun] = []

    warnings: List[str] = []
    sources: List[Dict[str, Any]] = []
    workflow_status: str = "PENDING"
    is_demo_data: bool = True

    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def uses_demo_data(self) -> bool:
        """True when any flight, available weather or alternative result is demo data."""
        return any(f.get("data_mode") == "demo" for f in self.flight_results) or any(
            w.get("is_mock") and w.get("status") == "available" for w in self.weather_results
        ) or any(option.get("data_mode") == "demo" for option in self.alternative_options)
