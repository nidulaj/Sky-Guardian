from typing import List, Literal

from pydantic import BaseModel, Field

RecommendationMode = Literal["llm", "template"]


class RecoveryPlan(BaseModel):
    """Passenger recovery plan. Written by the LLM (validated) or by the deterministic template."""
    headline: str = Field(..., min_length=1, max_length=200)
    what_happened: str = Field(..., max_length=800)
    impact: str = Field(..., max_length=800)
    recommended_action: str = Field(..., max_length=800)
    why_this_option: str = Field("", max_length=800)
    next_steps: List[str] = Field(default_factory=list, max_length=4)
    policy_citations: List[str] = []
    uncertainty: List[str] = []
    contact: str = Field("", max_length=300)


# Same structure for Gemini's responseSchema (OpenAPI subset).
RECOVERY_PLAN_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "headline": {"type": "STRING"},
        "what_happened": {"type": "STRING"},
        "impact": {"type": "STRING"},
        "recommended_action": {"type": "STRING"},
        "why_this_option": {"type": "STRING"},
        "next_steps": {"type": "ARRAY", "items": {"type": "STRING"}, "maxItems": 4},
        "policy_citations": {"type": "ARRAY", "items": {"type": "STRING"}},
        "uncertainty": {"type": "ARRAY", "items": {"type": "STRING"}},
        "contact": {"type": "STRING"},
    },
    "required": ["headline", "what_happened", "impact", "recommended_action", "why_this_option",
                 "next_steps", "policy_citations", "uncertainty", "contact"],
}
