from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

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
    recommended_option: Optional[Dict[str, Any]] = None
    recommendation_text: str = ""
    
    warnings: List[str] = []
    sources: List[Dict[str, Any]] = []
    workflow_status: str = "PENDING"
    is_demo_data: bool = True
    
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
